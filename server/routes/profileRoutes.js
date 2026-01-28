const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');

// 🟢 1. GET CURRENT USER PROFILE
// The App calls this automatically on startup
router.get('/', authMiddleware, async (req, res) => {
  try {
    // req.user.id comes from the Token (authMiddleware)
    // We don't need a phone number in the URL
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    // Return the user data
    res.json(user); // Send raw user object to match Frontend expectation
  } catch (err) {
    console.error("Get Profile Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🟢 2. UPDATE PROFILE (PUT)
router.put('/update', authMiddleware, async (req, res) => {
  try {
    // We use the ID from the token, so we can't update someone else's profile
    const userId = req.user.id;
    const updates = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId, 
      { $set: updates }, 
      { new: true, runValidators: true }
    ).select('-password');

    res.json(updatedUser);

  } catch (err) {
    console.error("❌ Update Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;