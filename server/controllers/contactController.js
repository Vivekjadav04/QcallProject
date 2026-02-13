const User = require('../models/User');
const UserContact = require('../models/UserContact');
const GlobalNumber = require('../models/GlobalNumber');
const SpamReport = require('../models/SpamReport');
const BlockedNumber = require('../models/BlockedNumber'); 

// ⚙️ SETTINGS: Change this number to control sensitivity
const SPAM_THRESHOLD = 50; // Number needs 50 reports to be marked "Spam"

// Helper: Clean phone numbers
const normalizeNumber = (num) => num ? num.replace(/[^\d+]/g, '') : '';

// 🟢 1. IDENTIFY CALLER (Updated with Threshold Logic)
exports.identifyCaller = async (req, res) => {
  try {
    const rawNum = req.query.number;
    const cleanNum = rawNum ? rawNum.replace(/[^\d]/g, '') : '';
    
    if (!cleanNum || cleanNum.length < 10) { 
        return res.status(400).json({ msg: "Invalid number" });
    }

    const last10 = cleanNum.slice(-10);
    const searchCriteria = { phoneNumber: { $regex: last10, $options: 'i' } };

    // Optimize: Use countDocuments instead of find() for speed
    const [spamCount, appUser, globalEntry] = await Promise.all([
        SpamReport.countDocuments(searchCriteria), 
        User.findOne(searchCriteria),
        GlobalNumber.findOne(searchCriteria)
    ]);

    // 🚀 NEW LOGIC: Only mark as SPAM if reports exceed threshold or Global DB says so
    // We calculate a percentage score based on the threshold
    let spamScore = 0;
    if (spamCount >= SPAM_THRESHOLD) spamScore = 100;
    else if (spamCount > 0) spamScore = Math.floor((spamCount / SPAM_THRESHOLD) * 100);

    // Override if Global Entry has a locked-in high score
    if (globalEntry && globalEntry.spamScore > spamScore) {
        spamScore = globalEntry.spamScore;
    }

    const isSpam = spamScore >= 80; // Only RED if score is very high

    if (isSpam || spamCount > 0) {
        let bestName = "Unknown Caller";
        let type = "UNKNOWN";

        if (isSpam) {
            bestName = "Likely Spam";
            type = "SPAM";
        }

        if (globalEntry && globalEntry.likelyName) {
            bestName = globalEntry.likelyName;
        } 
        else if (appUser) {
            bestName = `${appUser.firstName} ${appUser.lastName}`;
            type = "USER";
        }

        return res.json({
            found: true,
            type: type,
            name: bestName,
            isSpam: isSpam, // Boolean based on threshold
            spamScore: spamScore, // 0-100
            spamReports: spamCount,
            location: globalEntry?.location || "",
            spamType: globalEntry?.tags?.[0] || (isSpam ? "High Risk" : "Reports")
        });
    }

    if (appUser) {
        if (appUser.settings?.showCallerID === false) {
             return res.json({ found: false, type: "PRIVATE", name: "Private Number" });
        }
        return res.json({
            found: true,
            type: "USER",
            name: `${appUser.firstName} ${appUser.lastName}`.trim(),
            photo: appUser.profilePhoto,
            location: appUser.address ? appUser.address.city : "", 
            isSpam: false,
            isVerified: true
        });
    }

    if (globalEntry) {
        return res.json({
            found: true,
            type: "GLOBAL",
            name: globalEntry.likelyName || "Unknown Caller",
            location: globalEntry.location || "",
            isSpam: false
        });
    }

    return res.json({ found: false, type: "UNKNOWN", name: "Unknown Caller", isSpam: false });

  } catch (err) {
    console.error("Identify Error:", err.message);
    res.status(500).json({ msg: "Server Error" });
  }
};

// 🟢 2. SYNC CONTACTS (Kept Same)
exports.syncContacts = async (req, res) => {
  try {
    const { contacts } = req.body;
    const userId = req.user ? req.user.id : null; 

    if (!userId) return res.status(401).json({ msg: "User ID missing." });
    if (!contacts || !Array.isArray(contacts)) return res.status(400).json({ msg: "No contacts provided" });

    const ops = contacts.map(c => {
      const num = normalizeNumber(c.number);
      if(!num || num.length < 5) return null;
      return {
        updateOne: {
          filter: { userId: userId, phoneNumber: num }, 
          update: { $set: { contactName: c.name, updatedAt: new Date() } },
          upsert: true
        }
      };
    }).filter(o => o);

    if (ops.length > 0) await UserContact.bulkWrite(ops);
    
    // Fire and forget global name updates
    contacts.forEach(c => updateGlobalName(c.number, c.name));
    
    res.json({ success: true, count: ops.length });
  } catch (err) {
    console.error("Sync Error:", err.message);
    res.status(500).json({ msg: "Server Error" });
  }
};

// 🟢 3. REPORT SPAM (The "Ballot Box" Logic)
exports.reportSpam = async (req, res) => {
  try {
    const { number, tag, location, comment } = req.body;
    const cleanNum = normalizeNumber(number);
    const userId = req.user ? req.user.id : null;

    if (!cleanNum) return res.status(400).json({ msg: "Invalid Number" });

    // 1. Cast Vote (Will fail if user already voted due to Unique Index)
    try {
        await SpamReport.create({
            phoneNumber: cleanNum,
            reportedBy: userId,
            tag: tag || "Spam",
            location,
            comment
        });
    } catch (e) {
        if (e.code === 11000) {
            return res.status(400).json({ msg: "You have already reported this number." });
        }
        throw e;
    }

    // 2. Count Total Votes
    const totalReports = await SpamReport.countDocuments({ phoneNumber: cleanNum });

    // 3. Calculate New Global Score
    let newScore = 0;
    if (totalReports >= SPAM_THRESHOLD) newScore = 100;
    else newScore = Math.floor((totalReports / SPAM_THRESHOLD) * 100);

    // 4. Update the "Scoreboard" (Global Number)
    await GlobalNumber.findOneAndUpdate(
      { phoneNumber: cleanNum },
      { 
          $set: { spamScore: newScore, location: location },
          $addToSet: { tags: tag || "Spam" },
      },
      { upsert: true }
    );

    res.json({ success: true, msg: "Report received. Thank you for voting.", totalReports });

  } catch (err) {
    console.error("Report Error:", err.message);
    res.status(500).json({ msg: "Server Error" });
  }
};

// 🟢 4. NOT SPAM (Updated Score Logic)
exports.reportNotSpam = async (req, res) => {
    try {
        const { number } = req.body;
        const cleanNum = normalizeNumber(number);
        const userId = req.user ? req.user.id : null;

        if (!cleanNum) return res.status(400).json({ msg: "Invalid Number" });

        // Remove the user's vote
        await SpamReport.findOneAndDelete({
            phoneNumber: cleanNum,
            reportedBy: userId
        });

        // Recalculate Score from scratch (Safest way)
        const totalReports = await SpamReport.countDocuments({ phoneNumber: cleanNum });
        let newScore = 0;
        if (totalReports >= SPAM_THRESHOLD) newScore = 100;
        else if (totalReports > 0) newScore = Math.floor((totalReports / SPAM_THRESHOLD) * 100);

        const globalEntry = await GlobalNumber.findOneAndUpdate(
            { phoneNumber: cleanNum },
            { $set: { spamScore: newScore } },
            { new: true, upsert: true }
        );

        res.json({ 
            success: true, 
            msg: "Marked as safe.",
            newScore: globalEntry.spamScore
        });

    } catch (err) {
        console.error("Safe Mark Error:", err.message);
        res.status(500).json({ msg: "Server Error" });
    }
};

// 🟢 5. BLOCK NUMBER (Standard)
exports.blockNumber = async (req, res) => {
  try {
    const { number, alsoReportSpam } = req.body;
    const userId = req.user.id; 
    if (!number) return res.status(400).json({ message: "Number is required" });
    const cleanNum = normalizeNumber(number);

    await BlockedNumber.findOneAndUpdate(
      { user: userId, phoneNumber: cleanNum },
      { user: userId, phoneNumber: cleanNum, reason: "Manual Block" },
      { upsert: true, new: true }
    );

    if (alsoReportSpam && cleanNum) {
        // If blocking counts as a spam report, we call the logic manually
        // But for now, we just increment score slightly
        await GlobalNumber.findOneAndUpdate(
            { phoneNumber: cleanNum },
            { $inc: { spamScore: 1 } }, // Blocks have less weight than reports
            { upsert: true }
        );
    }
    res.json({ success: true, message: "Number blocked" });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// 🟢 6. UNBLOCK NUMBER (Standard)
exports.unblockNumber = async (req, res) => {
  try {
    const { number } = req.body;
    const userId = req.user.id; 
    if (!number) return res.status(400).json({ success: false, message: "Number is required" });
    const cleanNum = normalizeNumber(number);

    const deletedEntry = await BlockedNumber.findOneAndDelete({ user: userId, phoneNumber: cleanNum });

    if (!deletedEntry) return res.status(404).json({ success: false, message: "Not in blocked list." });

    res.json({ success: true, message: "Unblocked", removed: cleanNum });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// 🧠 HELPER: Intelligent Name Update
async function updateGlobalName(num, name) {
  try {
    const cleanNum = normalizeNumber(num);
    if (!cleanNum || !name) return;

    let entry = await GlobalNumber.findOne({ phoneNumber: cleanNum });
    
    if (!entry) {
      entry = new GlobalNumber({
        phoneNumber: cleanNum,
        likelyName: name,
        nameVariations: [{ name, count: 1 }]
      });
    } else {
      const variation = entry.nameVariations.find(v => v.name.toLowerCase() === name.toLowerCase());
      if (variation) variation.count++;
      else entry.nameVariations.push({ name, count: 1 });
      
      entry.nameVariations.sort((a, b) => b.count - a.count);
      entry.likelyName = entry.nameVariations[0].name;
    }
    await entry.save();
  } catch (e) { console.error("Global Update Fail:", e.message); }
}