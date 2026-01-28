const User = require('../models/User');
const UserContact = require('../models/UserContact');
const GlobalNumber = require('../models/GlobalNumber');
const SpamReport = require('../models/SpamReport');

// Helper: Clean phone numbers (+91-987... -> 91987...)
const normalizeNumber = (num) => num ? num.replace(/[^\d+]/g, '') : '';

// 🟢 1. IDENTIFY CALLER (The Waterfall Logic)
exports.identifyCaller = async (req, res) => {
  try {
    const cleanNum = normalizeNumber(req.query.number);
    if (!cleanNum) return res.status(400).json({ msg: "Invalid number" });

    // PRIORITY 1: Check Registered Users (Blue Badge)
    const appUser = await User.findOne({ phoneNumber: cleanNum })
      .select('firstName lastName profilePhoto address.city company.title settings');

    if (appUser) {
        // Privacy Check
        if (appUser.settings && appUser.settings.showCallerID === false) {
             return res.json({ found: false, type: "PRIVATE", name: "Private Number" });
        }

        return res.json({
            found: true,
            type: "USER",
            name: `${appUser.firstName} ${appUser.lastName}`.trim(),
            photo: appUser.profilePhoto,
            location: appUser.address ? appUser.address.city : "", 
            designation: appUser.company ? appUser.company.title : "",
            isSpam: false,
            isVerified: true
        });
    }

    // PRIORITY 2: Check Global Directory (Crowdsourced)
    const globalEntry = await GlobalNumber.findOne({ phoneNumber: cleanNum });
    if (globalEntry) {
        const isSpam = globalEntry.spamScore >= 10;
        return res.json({
            found: true,
            type: isSpam ? "SPAM" : "GLOBAL",
            name: globalEntry.likelyName,
            location: globalEntry.location || "", 
            isSpam: isSpam,
            spamScore: globalEntry.spamScore,
            spamType: isSpam ? (globalEntry.tags[0] || "Reported Spam") : null
        });
    }

    // PRIORITY 3: Unknown
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
    
    // CRITICAL FIX: Ensure we use the ID from the middleware
    const userId = req.user ? req.user.id : null; 

    if (!userId) {
        return res.status(401).json({ msg: "User ID missing. Token invalid." });
    }

    if (!contacts || !Array.isArray(contacts)) {
        return res.status(400).json({ msg: "No contacts provided" });
    }

    console.log(`[SYNC] Processing ${contacts.length} contacts for User: ${userId}`);

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
    // (We don't await this so the response is fast)
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
    const userId = req.user.id;

    if (!cleanNum) return res.status(400).json({ msg: "Invalid Number" });

    // A. Save Report Log
    await SpamReport.create({
      phoneNumber: cleanNum,
      reportedBy: userId,
      tag,
      location,
      comment
    });

    // B. Update Global Score
    await GlobalNumber.findOneAndUpdate(
      { phoneNumber: cleanNum },
      { 
          $inc: { spamScore: 10 }, 
          $addToSet: { tags: tag },
          $set: { location: location } // Update location if provided
      },
      { upsert: true }
    );

    res.json({ msg: "Report Saved" });

  } catch (err) {
    console.error("Report Error:", err.message);
    res.status(500).json({ msg: "Server Error" });
  }
};

// 🟢 4. NOT SPAM (Correction Logic)
exports.reportNotSpam = async (req, res) => {
    try {
        const { number } = req.body;
        const cleanNum = normalizeNumber(number);
        
        await GlobalNumber.updateOne(
            { phoneNumber: cleanNum },
            { $inc: { spamScore: -10 } } // Decrease score
        );

        res.json({ msg: "Marked as safe" });
    } catch (err) {
        res.status(500).json({ msg: "Server Error" });
    }
};

// 🧠 HELPER: Intelligent Name Update
// Takes a number and name, and votes for the best name in the Global DB
async function updateGlobalName(num, name) {
  try {
    const cleanNum = normalizeNumber(num);
    if (!cleanNum || !name) return;

    let entry = await GlobalNumber.findOne({ phoneNumber: cleanNum });
    
    if (!entry) {
      // New Entry
      entry = new GlobalNumber({
        phoneNumber: cleanNum,
        likelyName: name,
        nameVariations: [{ name, count: 1 }]
      });
    } else {
      // Existing Entry - Vote logic
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
      // Silent fail is okay for background tasks
      console.error("Global Update Fail:", e.message); 
  }
}