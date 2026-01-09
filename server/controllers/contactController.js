const GlobalNumber = require('../models/GlobalNumber');
const UserContact = require('../models/UserContact');

const normalizeNumber = (num) => {
  return num ? num.replace(/[^\d+]/g, '') : '';
};

// 1. SYNC CONTACTS (Dual Write Strategy)
exports.syncContacts = async (req, res) => {
  try {
    const { userId, contacts } = req.body; // Ensure userId is passed from app

    if (!contacts || !Array.isArray(contacts)) {
      return res.status(400).json({ msg: "Invalid data. 'contacts' array required." });
    }

    // 🟢 STEP 1: Bulk Save to User's Private List
    // We use 'bulkWrite' to process 50+ contacts in ONE database call.
    const userOps = contacts.map(contact => {
        const cleanNum = normalizeNumber(contact.number);
        if (!cleanNum || cleanNum.length < 5) return null;

        return {
            updateOne: {
                filter: { userId: userId, phoneNumber: cleanNum },
                update: { $set: { contactName: contact.name, updatedAt: new Date() } },
                upsert: true // Create if new, Update if exists
            }
        };
    }).filter(op => op !== null); // Remove invalid numbers

    if (userOps.length > 0) {
        await UserContact.bulkWrite(userOps);
    }

    // 🟢 STEP 2: Update Global Directory (The "Voting" System)
    // We don't await this loop to keep the API response fast for the user (Fire & Forget)
    contacts.forEach(async (contact) => {
        const cleanNum = normalizeNumber(contact.number);
        if (cleanNum && contact.name) {
            await updateGlobalEntry(cleanNum, contact.name);
        }
    });

    res.json({ msg: "Sync Successful", totalProcessed: userOps.length });

  } catch (err) {
    console.error("Sync Error:", err.message);
    res.status(500).json({ msg: "Server Error" });
  }
};

// Helper: Smart Voting Logic
async function updateGlobalEntry(num, name) {
    try {
        let entry = await GlobalNumber.findOne({ phoneNumber: num });

        if (!entry) {
            // New Number: Create it with 1 vote
            entry = new GlobalNumber({
                phoneNumber: num,
                likelyName: name,
                nameVariations: [{ name: name, count: 1 }],
                spamScore: 0
            });
        } else {
            // Existing Number: Check if this name exists
            const variationIndex = entry.nameVariations.findIndex(
                v => v.name.toLowerCase() === name.toLowerCase()
            );

            if (variationIndex > -1) {
                entry.nameVariations[variationIndex].count++; // Upvote existing name
            } else {
                entry.nameVariations.push({ name: name, count: 1 }); // Add new name variation
            }

            // Recalculate "Winner" Name
            // Sort by count descending (highest vote first)
            entry.nameVariations.sort((a, b) => b.count - a.count);
            entry.likelyName = entry.nameVariations[0].name;
        }

        await entry.save();
    } catch (e) {
        console.error("Global Update Failed for:", num, e.message);
    }
}

// 2. GET CALLER INFO (Search)
exports.getCallerInfo = async (req, res) => {
  try {
    const cleanNum = normalizeNumber(req.params.number);
    if (!cleanNum) return res.status(400).json({ msg: "Invalid number" });

    // Try finding in Global DB first
    const entry = await GlobalNumber.findOne({ phoneNumber: cleanNum });

    if (entry) {
      return res.json({
        found: true,
        name: entry.likelyName,
        isSpam: entry.spamScore > 50,
        spamScore: entry.spamScore
      });
    }

    // Optional Fallback: Check UserContact if you want to search private lists (usually not done for privacy)
    return res.json({ found: false, name: "Unknown", isSpam: false });

  } catch (err) {
    console.error("Search Error:", err.message);
    res.status(500).json({ msg: "Server Error" });
  }
};

// 3. REPORT NOT SPAM
exports.reportNotSpam = async (req, res) => {
    try {
        const { number } = req.body;
        const cleanNum = normalizeNumber(number);
        if (!cleanNum) return res.status(400).json({ msg: "Invalid number" });

        await GlobalNumber.updateOne(
            { phoneNumber: cleanNum },
            { $inc: { spamScore: -10 } } // Decrease spam score by 10
        );

        res.json({ msg: "Marked as safe" });
    } catch (err) {
        res.status(500).json({ msg: "Server Error" });
    }
};