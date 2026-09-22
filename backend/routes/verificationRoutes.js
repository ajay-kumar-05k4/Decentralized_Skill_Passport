const express = require('express');
const {
  requestVerification,
  getVerificationRequests,
  getMyVerificationRequests,
  claimVerification,
  decideVerification,
} = require('../controllers/verificationController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect);

const VERIFIER_ROLES = ['educational_institution', 'mentor_industry_expert', 'administrator'];

router.post('/', requestVerification);
router.get('/me', getMyVerificationRequests);
router.get('/', authorizeRoles(...VERIFIER_ROLES), getVerificationRequests);
router.put('/:id/claim', authorizeRoles(...VERIFIER_ROLES), claimVerification);
router.put('/:id/decision', authorizeRoles(...VERIFIER_ROLES), decideVerification);

module.exports = router;
