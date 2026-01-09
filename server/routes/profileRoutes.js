const express = require('express');
const router = express.Router();
const User = require('../models/User');

// 1. GET USER PROFILE
router.get('/:phone', async (req, res) => {
  try {
    // Find user by phone number
    const user = await User.findOne({ phoneNumber: req.params.phone });
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    // Return the user data
    res.json({ success: true, data: user });
  } catch (err) {
    console.error("Get Profile Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. UPDATE PROFILE (PUT)
router.put('/update', async (req, res) => {
  // 1. Separate the ID (phoneNumber) from the Data (updates)
  const { phoneNumber, ...updates } = req.body;

  // --- DEBUG LOGS ---
  console.log("👉 UPDATE REQUEST RECEIVED");
  console.log("Target Phone:", phoneNumber);
  console.log("Fields updating:", Object.keys(updates));
  // ------------------

  if (!phoneNumber) {
    return res.status(400).json({ success: false, message: "Phone number is required in the body" });
  }

  try {
    // 2. Find and Update the User
    const updatedUser = await User.findOneAndUpdate(
      { phoneNumber: phoneNumber }, 
      { $set: updates }, // Updates all fields sent from Frontend (including nested address/company)
      { new: true, runValidators: true } // Returns the NEW updated document
    );

    if (!updatedUser) {
      console.log("❌ User not found in DB");
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log("✅ Profile Updated Successfully");
    res.json({ success: true, data: updatedUser });

  } catch (err) {
    console.error("❌ Update Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;