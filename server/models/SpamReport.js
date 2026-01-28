const mongoose = require('mongoose');

const SpamReportSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true, index: true },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional
  tag: { type: String }, // "Scam", "Marketing"
  comment: { type: String },
  location: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SpamReport', SpamReportSchema);