const express = require('express');
const {
  createCredential,
  getMyCredentials,
  getCredentialsByUser,
  getCredentialById,
  updateCredential,
  deleteCredential,
} = require('../controllers/credentialController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.use(protect);

router.post('/', upload.single('file'), createCredential);
router.get('/me', getMyCredentials);
router.get('/user/:userId', getCredentialsByUser);
router.get('/:id', getCredentialById);
router.put('/:id', upload.single('file'), updateCredential);
router.delete('/:id', deleteCredential);

module.exports = router;
