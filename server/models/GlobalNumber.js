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
  
  // 🟢 CROWDSOURCING LOGIC
  // We store every name users sync for this number.
  // e.g. [{ name: "Pizza Hut", count: 5 }, { name: "Pizza Place", count: 2 }]
  nameVariations: [{
    name: { type: String, required: true },
    count: { type: Number, default: 1 }
  }],

  // 🟢 SPAM LOGIC
  spamScore: { type: Number, default: 0 }, // Score > 10 = Spam
  tags: [{ type: String }], // e.g. ["Telemarketer", "Scam"]
  
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GlobalNumber', GlobalNumberSchema);