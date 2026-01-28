// File: server/routes/auth.js
const router = require('express').Router();
const authController = require('../controllers/authController');

// --- 1. CHECK IF USER EXISTS ---
router.post('/check-user', authController.checkUser);

// --- 2. LOGIN (Existing User) ---
router.post('/login', authController.login);

// --- 3. REGISTER (New User) ---
router.post('/register', authController.register);

module.exports = router;