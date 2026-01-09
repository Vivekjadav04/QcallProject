const router = require('express').Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// --- 1. CHECK IF USER EXISTS ---
// (Called by Login Screen to decide navigation)
router.post('/check-user', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const user = await User.findOne({ phoneNumber });
    // Returns true if user exists, false if new
    res.json({ exists: !!user }); 
  } catch (err) {
    console.error("Check User Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- 2. LOGIN (Existing User) ---
// (Called by OTP Screen after successful local verification)
router.post('/login', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    // Find User
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate Token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "secret", { expiresIn: "30d" });

    // Return Data
    res.json({ 
      message: "Login successful", 
      token, 
      user 
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// --- 3. REGISTER (New User) ---
// (Called by Register Screen after successful local verification)
router.post('/register', async (req, res) => {
  try {
    const { phoneNumber, name, email } = req.body;

    // Double Check: Does user already exist?
    let user = await User.findOne({ phoneNumber });
    if (user) {
      return res.status(400).json({ message: "User already exists. Please login." });
    }

    // Create New User
    user = new User({
      phoneNumber,
      name,
      email,
      password: "otp_user", // Placeholder since we use OTP
      qrCodeId: "QR_" + phoneNumber // Keep your custom logic
    });

    await user.save();
    console.log(`\n🆕 NEW USER REGISTERED: ${name} (${phoneNumber})`);

    // Generate Token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "secret", { expiresIn: "30d" });

    // Return Data
    res.status(201).json({ 
      message: "User created successfully", 
      token, 
      user 
    });

  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;