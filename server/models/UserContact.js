const mongoose = require('mongoose');

const UserContactSchema = new mongoose.Schema({
  userId: {
    type: String, // Or mongoose.Schema.Types.ObjectId if using User model
    required: true,
    index: true
  },
  phoneNumber: {
    type: String,
    required: true,
    index: true
  },
  contactName: {
    type: String,
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 🟢 CRITICAL: This ensures ONE user can only save ONE number once.
// But DIFFERENT users can save the same number.
UserContactSchema.index({ userId: 1, phoneNumber: 1 }, { unique: true });

module.exports = mongoose.model('UserContact', UserContactSchema);