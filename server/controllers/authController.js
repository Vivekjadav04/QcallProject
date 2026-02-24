const User = require('../models/User');
const jwt = require('jsonwebtoken');

// 1. CHECK IF USER EXISTS
exports.checkUser = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const user = await User.findOne({ phoneNumber });
    res.json({ exists: !!user }); 
  } catch (err) {
    console.error("Check User Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// 2. LOGIN (Existing User)
exports.login = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    // Find User
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Determine if Premium is active based on the expiration date
    let isPremiumActive = false;
    if (user.subscription && user.subscription.expiresAt) {
      if (new Date() < new Date(user.subscription.expiresAt)) {
        isPremiumActive = true;
      }
    }

    // Generate Token
    const token = jwt.sign(
      { id: user._id }, 
      process.env.JWT_SECRET || "secret", 
      { expiresIn: "30d" }
    );

    // Return Data including the subscription object for the 24-hour sync
    res.json({ 
      message: "Login successful", 
      token, 
      user,
      isPremiumActive // Helper boolean for frontend
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// 3. REGISTER (New User)
exports.register = async (req, res) => {
  try {
    const { phoneNumber, firstName, lastName, email } = req.body;

    // Check if user already exists
    let user = await User.findOne({ phoneNumber });
    if (user) {
      return res.status(400).json({ message: "User already exists. Please login." });
    }

    // Create New User with default Free subscription
    user = new User({
      phoneNumber,
      firstName,
      lastName,
      email,
      password: "otp_user", 
      qrCodeId: "QR_" + phoneNumber,
      subscription: {
        status: 'none',
        planName: 'Free',
        activeFeatures: [],
        expiresAt: null
      }
    });

    await user.save();
    
    // Generate Token
    const token = jwt.sign(
      { id: user._id }, 
      process.env.JWT_SECRET || "secret", 
      { expiresIn: "30d" }
    );

    res.status(201).json({ 
      message: "User created successfully", 
      token, 
      user 
    });

  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ error: err.message });
  }
};