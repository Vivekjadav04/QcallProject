const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');

// @route   POST /api/contacts/sync
// @desc    Syncs private contacts AND updates global directory
router.post('/sync', contactController.syncContacts);

// @route   GET /api/contacts/search/:number
// @desc    Search for a number (Caller ID)
router.get('/search/:number', contactController.getCallerInfo);

// @route   POST /api/contacts/not-spam
// @desc    Mark a number as safe
router.post('/not-spam', contactController.reportNotSpam);

module.exports = router;