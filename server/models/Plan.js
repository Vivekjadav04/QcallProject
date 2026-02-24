// models/Plan.js
const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
    plan_name: { type: String, required: true },
    price: { type: Number, required: true },
    duration_days: { type: Number, required: true },
    features: { type: [String], default: [] }, // Array of features like "no_ads", "golden_caller_id"
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    created_at: { type: Date, default: Date.now }
}, { 
    // This tells Mongoose to use the exact collection name PHP created
    collection: 'subscription_plans' 
});

module.exports = mongoose.model('Plan', planSchema);