const mongoose = require('mongoose');

const UserContactSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  phoneNumber: { type: String, required: true, index: true },
  contactName: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index to ensure a user doesn't duplicate the same number
UserContactSchema.index({ userId: 1, phoneNumber: 1 }, { unique: true });

module.exports = mongoose.model('UserContact', UserContactSchema);