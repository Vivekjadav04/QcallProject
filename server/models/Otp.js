const mongoose = require('mongoose');

const OtpSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true
  },
  otp: {
    type: String,
    required: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now, 
    index: { expires: 300 } // AUTOMATICALLY DELETE after 300 seconds (5 mins)
  } 
});

module.exports = mongoose.model('Otp', OtpSchema);