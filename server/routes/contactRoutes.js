const express = require('express');
const router = express.Router();

const contactController = require('../controllers/contactController');
const authMiddleware = require('../middleware/authMiddleware');

// 🟢 POST /api/contacts/sync
router.post('/sync', authMiddleware, contactController.syncContacts);

// 🟢 GET /api/contacts/identify
router.get('/identify', contactController.identifyCaller);

// 🟢 POST /api/contacts/report
router.post('/report', authMiddleware, contactController.reportSpam);

// 🟢 POST /api/contacts/not-spam
router.post('/not-spam', authMiddleware, contactController.reportNotSpam);

module.exports = router;