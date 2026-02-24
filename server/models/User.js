const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  // --- AUTH FIELDS ---
  phoneNumber: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  password: { 
    type: String, 
    required: false 
  },

  // --- PROFILE BASICS ---
  firstName: { type: String, default: "" },
  lastName: { type: String, default: "" },
  email: { type: String, default: "" },
  profilePhoto: { type: String, default: "" }, 

  // --- CONTACT INFO ---
  secondPhoneNumber: { type: String, default: "" },

  // --- PERSONAL DETAILS ---
  birthday: { type: String, default: "" }, 
  gender: { type: String, enum: ['Male', 'Female', 'Other', ''], default: '' },

  // --- ADDRESS ---
  address: {
    street: { type: String, default: "" },
    zipCode: { type: String, default: "" },
    city: { type: String, default: "" },
    country: { type: String, default: "India" }
  },

  // --- WORK ---
  company: {
    title: { type: String, default: "" },
    website: { type: String, default: "" }
  },

  // --- ABOUT & SKILLS ---
  aboutMe: { type: String, default: "" },
  tags: [{ type: String }],

  // --- SUBSCRIPTION & ACCOUNT STATUS ---
  // This is the new structure to support your 24-hour sync and PHP Admin features
  subscription: {
    status: { 
      type: String, 
      lowercase: true, // 🟢 FIX: Tells DB to always make this lowercase automatically
      enum: ['active', 'inactive', 'none', 'expired'], // 🟢 FIX: Added 'expired' so the Admin panel doesn't crash it
      default: 'none' 
    },
    planName: { type: String, default: 'Free' },
    expiresAt: { type: Date, default: null },
    // Features like 'no_ads' or 'golden_caller_id' are stored here
    activeFeatures: { type: [String], default: [] } 
  },

  accountType: {
    type: String,
    lowercase: true, // 🟢 FIX: Tells DB to always make this lowercase automatically
    enum: ['free', 'gold', 'platinum'],
    default: 'free'
  },

  settings: {
    blockSpamCalls: { type: Boolean, default: false },
    showCallerID: { type: Boolean, default: true }
  },

  // --- QR CODE ---
  qrCodeId: {
    type: String,
    unique: true,
    sparse: true 
  },

  joinedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema);