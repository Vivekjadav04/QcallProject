const mongoose = require('mongoose');

const GlobalNumberSchema = new mongoose.Schema({
  phoneNumber: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  
  // The "Winner" name (most popular vote)
  likelyName: { type: String, default: "" }, 
  
  location: { type: String, default: "" },
  carrier: { type: String }, // Optional: Good to have for future
  
  // 🟢 CROWDSOURCING LOGIC
  nameVariations: [{
    name: { type: String, required: true },
    count: { type: Number, default: 1 }
  }],

  // 🟢 SPAM LOGIC
  spamScore: { type: Number, default: 0 }, // 0 to 100
  tags: [{ type: String }], // e.g. ["Telemarketer", "Scam"]
  
  // 🆕 REQUIRED: This was missing!
  // Used by the blockNumber controller to track recency
  lastReported: { type: Date },

  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true }); // Automatically manages createdAt/updatedAt

module.exports = mongoose.model('GlobalNumber', GlobalNumberSchema);