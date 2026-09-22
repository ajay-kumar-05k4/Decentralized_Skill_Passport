const express = require('express');
const {
  getUsers,
  getUserById,
  updateMyProfile,
  updateUser,
  deleteUser,
  listRoles,
  getPlatformStats,
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect);

// Static paths must stay above '/:id' or Express matches them as an id
router.get('/roles/list', listRoles);
router.get('/stats/overview', authorizeRoles('administrator'), getPlatformStats);
router.put('/me', updateMyProfile);

router.get('/', authorizeRoles('administrator'), getUsers);
router.get('/:id', authorizeRoles('administrator'), getUserById);
router.put('/:id', authorizeRoles('administrator'), updateUser);
router.delete('/:id', authorizeRoles('administrator'), deleteUser);

module.exports = router;
