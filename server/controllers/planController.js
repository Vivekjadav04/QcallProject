const Plan = require('../models/Plan');

// 🟢 1. GET ALL ACTIVE PLANS
exports.getActivePlans = async (req, res) => {
  try {
    // Fetch only active plans and sort them by price (lowest to highest)
    const plans = await Plan.find({ status: 'active' }).sort({ price: 1 });

    if (!plans || plans.length === 0) {
      return res.status(404).json({ success: false, msg: "No active plans found." });
    }

    res.json({
      success: true,
      count: plans.length,
      data: plans
    });

  } catch (err) {
    console.error("Plan Fetch Error:", err.message);
    res.status(500).json({ success: false, msg: "Server Error while fetching plans" });
  }
};