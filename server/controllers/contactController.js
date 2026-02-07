const User = require('../models/User');
const UserContact = require('../models/UserContact');
const GlobalNumber = require('../models/GlobalNumber');
const SpamReport = require('../models/SpamReport');
const BlockedNumber = require('../models/BlockedNumber'); 

// Helper: Clean phone numbers (+91-987... -> 91987...)
const normalizeNumber = (num) => num ? num.replace(/[^\d+]/g, '') : '';

// 🟢 1. IDENTIFY CALLER (The "Nuclear" Regex Logic)
exports.identifyCaller = async (req, res) => {
  try {
    const rawNum = req.query.number;
    // Remove all non-numeric chars to get pure digits for length check
    const cleanNum = rawNum ? rawNum.replace(/[^\d]/g, '') : '';
    
    if (!cleanNum || cleanNum.length < 10) { 
        return res.status(400).json({ msg: "Invalid number" });
    }

    // 1. GET THE FINGERPRINT (Last 10 Digits)
    const last10 = cleanNum.slice(-10);
    
    // 🔍 SEARCH LOGIC: Find any number that CONTAINS these 10 digits
    const searchCriteria = { phoneNumber: { $regex: last10, $options: 'i' } };

    // 2. PARALLEL SEARCH (Global, User, Spam)
    const [spamReports, appUser, globalEntry] = await Promise.all([
        SpamReport.find(searchCriteria), // Find ALL matching reports
        User.findOne(searchCriteria),
        GlobalNumber.findOne(searchCriteria)
    ]);

    // 3. PRIORITY LOGIC (The "Override")

    // ➤ STEP A: CHECK SPAM (Force Red Screen)
    const spamCount = spamReports.length;
    const isGlobalSpam = globalEntry && globalEntry.spamScore >= 10;
    
    // IF FOUND IN SPAM REPORTS -> IT IS RED. NO EXCEPTIONS.
    if (spamCount > 0 || isGlobalSpam) {
        
        // 🧠 NAME RECOVERY: Get the best name available
        let bestName = "Likely Spam"; // Default
        
        // If Global has a name, STEAL IT for the Red Screen (e.g. "Fake Bank Agent")
        if (globalEntry && globalEntry.likelyName) {
            bestName = globalEntry.likelyName;
        } 
        // If it's a User but also Spam, use their name
        else if (appUser) {
            bestName = `${appUser.firstName} ${appUser.lastName}`;
        }

        return res.json({
            found: true,
            type: "SPAM",           // 🚨 FORCE RED SCREEN
            name: bestName,         // Shows the name we found
            isSpam: true,
            spamReports: spamCount,
            location: globalEntry?.location || "",
            spamType: globalEntry?.tags?.[0] || "Reported Spam"
        });
    }

    // ➤ STEP B: CHECK USER (Blue Screen)
    if (appUser) {
        if (appUser.settings?.showCallerID === false) {
             return res.json({ found: false, type: "PRIVATE", name: "Private Number" });
        }
        return res.json({
            found: true,
            type: "USER",        // <--- Triggers BLUE screen
            name: `${appUser.firstName} ${appUser.lastName}`.trim(),
            photo: appUser.profilePhoto,
            location: appUser.address ? appUser.address.city : "", 
            designation: appUser.company ? appUser.company.title : "",
            isSpam: false,
            isVerified: true
        });
    }

    // ➤ STEP C: CHECK GLOBAL (Blue Screen)
    if (globalEntry) {
        return res.json({
            found: true,
            type: "GLOBAL",      // <--- Triggers BLUE screen
            name: globalEntry.likelyName || "Unknown Caller",
            location: globalEntry.location || "",
            isSpam: false
        });
    }

    // --- STEP D: Unknown ---
    return res.json({ found: false, type: "UNKNOWN", name: "Unknown Caller", isSpam: false });

  } catch (err) {
    console.error("Identify Error:", err.message);
    res.status(500).json({ msg: "Server Error" });
  }
};

// 🟢 2. SYNC CONTACTS (With Batching & Global Updates)
exports.syncContacts = async (req, res) => {
  try {
    const { contacts } = req.body;
    const userId = req.user ? req.user.id : null; 

    if (!userId) return res.status(401).json({ msg: "User ID missing. Token invalid." });
    if (!contacts || !Array.isArray(contacts)) return res.status(400).json({ msg: "No contacts provided" });

    // A. Prepare Bulk Operations for User's Private Book
    const ops = contacts.map(c => {
      const num = normalizeNumber(c.number);
      if(!num || num.length < 5) return null;
      
      return {
        updateOne: {
          filter: { userId: userId, phoneNumber: num }, 
          update: { 
              $set: { contactName: c.name, updatedAt: new Date() } 
          },
          upsert: true
        }
      };
    }).filter(o => o);

    if (ops.length > 0) {
        await UserContact.bulkWrite(ops);
    }

    // B. Background Update for Global Directory
    contacts.forEach(c => updateGlobalName(c.number, c.name));

    res.json({ success: true, count: ops.length });

  } catch (err) {
    console.error("Sync Error:", err.message);
    res.status(500).json({ msg: "Server Error" });
  }
};

// 🟢 3. REPORT SPAM (Full Logic)
exports.reportSpam = async (req, res) => {
  try {
    const { number, tag, location, comment } = req.body;
    const cleanNum = normalizeNumber(number);
    const userId = req.user ? req.user.id : null;

    if (!cleanNum) return res.status(400).json({ msg: "Invalid Number" });

    // A. Save Report Log
    await SpamReport.create({
      phoneNumber: cleanNum,
      reportedBy: userId,
      tag: tag || "Spam",
      location,
      comment
    });

    // B. Update Global Score
    await GlobalNumber.findOneAndUpdate(
      { phoneNumber: cleanNum },
      { 
          $inc: { spamScore: 10 }, 
          $addToSet: { tags: tag || "Spam" },
          $set: { location: location } 
      },
      { upsert: true }
    );

    res.json({ success: true, msg: "Number reported as spam successfully" });

  } catch (err) {
    console.error("Report Error:", err.message);
    res.status(500).json({ msg: "Server Error" });
  }
};

// 🟢 4. NOT SPAM (🔥 UPDATED: Smart Cleanup Logic)
exports.reportNotSpam = async (req, res) => {
    try {
        const { number } = req.body;
        const cleanNum = normalizeNumber(number);
        const userId = req.user ? req.user.id : null;

        if (!cleanNum) return res.status(400).json({ msg: "Invalid Number" });
        if (!userId) return res.status(401).json({ msg: "Unauthorized" });

        // ➤ STEP A: ZOMBIE KILLER 🧟‍♂️🔫
        // Find and DELETE the report made by THIS user for THIS number.
        const deletedReport = await SpamReport.findOneAndDelete({
            phoneNumber: cleanNum,
            reportedBy: userId
        });

        // ➤ STEP B: CALCULATE IMPACT
        // If we deleted a report, undo the damage (-10). 
        // If they never reported it but trust it, lower it slightly (-5).
        const scoreDrop = deletedReport ? -10 : -5;

        // ➤ STEP C: UPDATE GLOBAL SCORE
        const globalEntry = await GlobalNumber.findOneAndUpdate(
            { phoneNumber: cleanNum },
            { $inc: { spamScore: scoreDrop } },
            { new: true, upsert: true } // Return the NEW updated document
        );

        // ➤ STEP D: AUTOMATIC TAG CLEANUP 🧹
        // If score drops below 10, remove "Spam" tag
        if (globalEntry.spamScore < 10) {
            await GlobalNumber.updateOne(
                { phoneNumber: cleanNum },
                { $pull: { tags: "Spam" } }
            );
        }

        res.json({ 
            success: true, 
            msg: deletedReport ? "Report withdrawn. Marked safe." : "Marked as safe.",
            newScore: globalEntry.spamScore
        });

    } catch (err) {
        console.error("Safe Mark Error:", err.message);
        res.status(500).json({ msg: "Server Error" });
    }
};

// 🟢 5. BLOCK NUMBER (Uses BlockedNumber Model)
exports.blockNumber = async (req, res) => {
  try {
    const { number, alsoReportSpam } = req.body;
    const userId = req.user.id; // From Auth Middleware

    if (!number) return res.status(400).json({ message: "Number is required" });

    const cleanNum = normalizeNumber(number);

    // A. Save to BlockedNumber Collection
    await BlockedNumber.findOneAndUpdate(
      { user: userId, phoneNumber: cleanNum },
      { user: userId, phoneNumber: cleanNum, reason: "Manual Block" },
      { upsert: true, new: true }
    );

    // B. Optional: Report as spam globally
    if (alsoReportSpam && cleanNum) {
      await GlobalNumber.findOneAndUpdate(
        { phoneNumber: cleanNum },
        { 
          $inc: { spamScore: 10 }, 
          $addToSet: { tags: "Blocked" },
          $set: { lastReported: new Date() } 
        }, 
        { upsert: true }
      );
    }

    res.json({ success: true, message: "Number blocked successfully" });

  } catch (error) {
    console.error("Block Error:", error.message);
    res.status(500).json({ message: "Server Error" });
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
      if (variation) {
          variation.count++;
      } else {
          entry.nameVariations.push({ name, count: 1 });
      }
      // Find the most popular name
      entry.nameVariations.sort((a, b) => b.count - a.count);
      entry.likelyName = entry.nameVariations[0].name;
    }
    await entry.save();
  } catch (e) { 
      console.error("Global Update Fail:", e.message); 
  }
}