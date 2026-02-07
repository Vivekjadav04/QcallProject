const mongoose = require('mongoose');

const BlockedNumberSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  // Optional: Allows users to note why they blocked it (e.g., "Spam", "Personal")
  reason: { 
    type: String, 
    default: "User Blocked" 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// 🚀 PERFORMANCE INDEX
// 1. Ensures a user can't block the same number twice.
// 2. Makes searching "Is this number blocked?" extremely fast.
BlockedNumberSchema.index({ user: 1, phoneNumber: 1 }, { unique: true });

module.exports = mongoose.model('BlockedNumber', BlockedNumberSchema);