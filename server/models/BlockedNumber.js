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
  reason: { 
    type: String, 
    default: "User Blocked" 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// 🚀 Allows unique, lightning-fast queries for (User + Number)
BlockedNumberSchema.index({ user: 1, phoneNumber: 1 }, { unique: true });

module.exports = mongoose.model('BlockedNumber', BlockedNumberSchema);