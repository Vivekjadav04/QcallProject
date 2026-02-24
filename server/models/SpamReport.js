const mongoose = require('mongoose');

const SpamReportSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true, index: true },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
  tag: { type: String, required: true }, // 🟢 Added required: true
  comment: { type: String },
  location: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// 🔒 CRITICAL: Prevent duplicate voting. 
// One user can report a specific phone number only ONCE.
SpamReportSchema.index({ phoneNumber: 1, reportedBy: 1 }, { unique: true });

module.exports = mongoose.model('SpamReport', SpamReportSchema);