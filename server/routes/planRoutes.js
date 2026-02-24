const express = require('express');
const router = express.Router();

const planController = require('../controllers/planController');
const authMiddleware = require('../middleware/authMiddleware'); // Your JWT Validator

// 🟢 GET /api/plans
// We use authMiddleware so only logged-in users can see the plans
router.get('/', authMiddleware, planController.getActivePlans);

module.exports = router;