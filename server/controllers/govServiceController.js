const GovService = require('../models/GovService');

// @desc    Get all Government Services grouped by category
// @route   GET /api/gov-services
// @access  Public (or add auth middleware if required)
exports.getGovServices = async (req, res) => {
    try {
        // Fetch all services from MongoDB, sorted by Category then Title
        const services = await GovService.find().sort({ category: 1, title: 1 });

        // Group the data specifically for React Native's <SectionList>
        const groupedData = [];
        const groupMap = {};

        services.forEach(service => {
            const cat = service.category || 'General';
            
            // If category doesn't exist in map yet, create it
            if (!groupMap[cat]) {
                groupMap[cat] = { category: cat, data: [] };
                groupedData.push(groupMap[cat]);
            }

            // Push the formatted service into the correct category array
            groupMap[cat].data.push({
                id: service._id.toString(),
                title: service.title,
                number: service.number,
                desc: service.description || '',
                icon: service.icon || 'shield'
            });
        });

        // Send successful response
        res.status(200).json({
            success: true,
            data: groupedData
        });

    } catch (error) {
        console.error('Gov Services Fetch Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server Error while fetching government services' 
        });
    }
};