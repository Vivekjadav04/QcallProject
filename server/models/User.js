const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  // --- AUTH FIELDS ---
  phoneNumber: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  // Keep password if you use it, or make it optional if using OTP only
  password: { 
    type: String, 
    required: false 
  },

  // --- PROFILE BASICS ---
  firstName: { type: String, default: "" },
  lastName: { type: String, default: "" },
  email: { type: String, default: "" },
  
  // Renamed from 'profilePickUrl' to match new Frontend 'profilePhoto'
  profilePhoto: { type: String, default: "" }, 

  // --- CONTACT INFO ---
  secondPhoneNumber: { type: String, default: "" },

  // --- PERSONAL DETAILS ---
  birthday: { type: String, default: "" }, // Format: DD/MM/YYYY
  gender: { type: String, enum: ['Male', 'Female', 'Other', ''], default: '' },

  // --- ADDRESS (Nested Object) ---
  address: {
    street: { type: String, default: "" },
    zipCode: { type: String, default: "" },
    city: { type: String, default: "" },
    country: { type: String, default: "India" }
  },

  // --- WORK (Nested Object) ---
  company: {
    title: { type: String, default: "" },   // Job Title
    website: { type: String, default: "" }  // Website URL
  },

  // --- ABOUT & SKILLS ---
  aboutMe: { type: String, default: "" },
  tags: [{ type: String }], // Stores ["Developer", "Designer", etc.]

  // --- ACCOUNT STATUS (Existing) ---
  accountType: {
    type: String,
    enum: ['free', 'gold', 'platinum'],
    default: 'free'
  },
  settings: {
    blockSpamCalls: { type: Boolean, default: false },
    showCallerID: { type: Boolean, default: true }
  },

  // --- QR CODE (Existing) ---
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