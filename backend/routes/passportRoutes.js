const express = require('express');
const {
  getMyPassport,
  getPassportByUser,
  createShareLink,
  listShareLinks,
  revokeShareLink,
  getSharedPassport,
} = require('../controllers/passportController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

// Public: opened by whoever holds a valid share token. Declared before
// router.use(protect) so it stays unauthenticated.
router.get('/shared/:token', getSharedPassport);

router.use(protect);

router.get('/me', getMyPassport);
router.get('/share', listShareLinks);
router.post('/share', createShareLink);
router.delete('/share/:token', revokeShareLink);

router.get(
  '/user/:userId',
  authorizeRoles(
    'employer_recruiter',
    'educational_institution',
    'mentor_industry_expert',
    'administrator'
  ),
  getPassportByUser
);

module.exports = router;
