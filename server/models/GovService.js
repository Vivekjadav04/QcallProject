const mongoose = require('mongoose');

const GovServiceSchema = new mongoose.Schema({
    category: { type: String, required: true },
    title: { type: String, required: true },
    number: { type: String, required: true },
    description: { type: String },
    icon: { type: String, default: 'shield' },
    createdAt: { type: Date, default: Date.now }
}, { collection: 'gov_services' }); // Explicitly connect to the collection the PHP admin creates

module.exports = mongoose.model('GovService', GovServiceSchema);