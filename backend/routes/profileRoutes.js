const express = require('express');
const {
  getMyProfile,
  getProfileByUserId,
  updateMyProfile,
  addSkillToProfile,
  removeSkillFromProfile,
  endorseSkill,
} = require('../controllers/profileController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect);

router.get('/me', getMyProfile);
router.put('/me', updateMyProfile);
router.post('/me/skills', addSkillToProfile);
router.delete('/me/skills/:skillId', removeSkillFromProfile);

router.get('/:userId', getProfileByUserId);
router.post(
  '/:userId/skills/:skillId/endorse',
  authorizeRoles('mentor_industry_expert', 'employer_recruiter', 'administrator'),
  endorseSkill
);

module.exports = router;
