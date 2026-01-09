// models/GlobalNumber.js
const mongoose = require('mongoose');

const GlobalNumberSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true, // This ensures one entry per phone number
    index: true   // Makes searching very fast
  },
  likelyName: {
    type: String, // The most common name for this number
    default: "Unknown"
  },
  spamScore: {
    type: Number,
    default: 0
  },
  // We keep track of all names users have saved this number as
  // e.g. [{ name: "Rakib", count: 5 }, { name: "Rakib Dev", count: 2 }]
  nameVariations: [
    {
      name: String,
      count: { type: Number, default: 1 }
    }
  ],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('GlobalNumber', GlobalNumberSchema);