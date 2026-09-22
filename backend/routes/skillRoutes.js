const express = require('express');
const {
  createSkill,
  getSkills,
  getSkillById,
  deleteSkill,
} = require('../controllers/skillController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', getSkills);
router.get('/:id', getSkillById);
router.post('/', authorizeRoles('administrator', 'educational_institution'), createSkill);
router.delete('/:id', authorizeRoles('administrator'), deleteSkill);

module.exports = router;
