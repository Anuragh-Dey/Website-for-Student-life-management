const express = require('express');
const router = express.Router();
const {
  signup, login, requestFirstLoginCode, verifyFirstLoginCode, logout
} = require('../controllers/authController');
const auth = require('../middleware/auth');

// Public
router.post('/signup', signup);
router.post('/login', login);
router.post('/request-first-login-code', requestFirstLoginCode);
router.post('/verify-first-login-code', verifyFirstLoginCode);

// Protected (needs Bearer token)
router.post('/logout', auth(), logout);

module.exports = router;
