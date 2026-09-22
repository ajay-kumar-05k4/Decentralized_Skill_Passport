const express = require('express');
const {
  registerIdentity,
  getIdentityStatus,
  confirmIdentity,
  resetIdentity,
} = require('../controllers/identityController');
const { protect } = require('../middleware/authMiddleware');
const { rateLimit } = require('../utils/rateLimit');

const router = express.Router();

router.use(protect);

// Identity checks involve a secret phrase, so they get their own throttle
const identityLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'Too many identity attempts. Please wait a few minutes and try again.',
});

router.get('/me', getIdentityStatus);
router.post('/me', identityLimiter, registerIdentity);
router.put('/me', identityLimiter, resetIdentity);
router.post('/me/confirm', identityLimiter, confirmIdentity);

module.exports = router;
