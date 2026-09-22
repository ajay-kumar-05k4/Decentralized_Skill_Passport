const express = require('express');
const {
  verifyIdentity,
  verifyCredential,
  verifyLinkage,
  verifyFull,
} = require('../controllers/verifyController');
const { rateLimit } = require('../utils/rateLimit');

const router = express.Router();

// PUBLIC on purpose: a recruiter verifying a candidate is a third party and
// must not need an account. Rate limited because it takes no auth.
const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many verification attempts. Please try again in a minute.',
});

router.use(verifyLimiter);

router.post('/identity', verifyIdentity);
router.post('/credential', verifyCredential);
router.post('/linkage', verifyLinkage);
router.post('/full', verifyFull);

module.exports = router;
