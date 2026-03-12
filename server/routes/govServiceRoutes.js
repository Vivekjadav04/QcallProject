const express = require('express');
const router = express.Router();
const { getGovServices } = require('../controllers/govServiceController');

// Route: GET /api/gov-services/
router.get('/', getGovServices);

module.exports = router;