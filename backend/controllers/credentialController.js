const fs = require('fs');
const path = require('path');
const asyncHandler = require('express-async-handler');
const Credential = require('../models/Credential');
const VerificationRequest = require('../models/VerificationRequest');
const { hashFile, hashCredentialMetadata } = require('../utils/hash');
const { notify } = require('../utils/notify');

// The credential hash is what a third-party verifier submits, so it must be
// reproducible from the artefact itself: the file bytes when a document was
// uploaded, otherwise the canonical metadata.
const computeCredentialHash = async (req, credential) => {
  if (req.file) return hashFile(req.file.path);
  return hashCredentialMetadata(credential);
};

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');

// Remove a previously stored upload so deleted/replaced credentials don't
// leave orphan files behind on disk.
const removeStoredFile = (fileUrl) => {
  if (!fileUrl) return;
  const absolute = path.join(UPLOAD_ROOT, fileUrl.replace(/^\/uploads\//, ''));
  if (!absolute.startsWith(UPLOAD_ROOT)) return; // guard against path traversal
  fs.promises.unlink(absolute).catch(() => {});
};

// @desc    Create/upload a new credential
// @route   POST /api/credentials
// @access  Private
const createCredential = asyncHandler(async (req, res) => {
  const { title, issuer, credentialType, issueDate, expiryDate } = req.body;

  if (!title || !issuer || !issueDate) {
    if (req.file) removeStoredFile(`/uploads/credentials/${req.file.filename}`);
    res.status(400);
    throw new Error('title, issuer and issueDate are required');
  }

  if (Number.isNaN(new Date(issueDate).getTime())) {
    if (req.file) removeStoredFile(`/uploads/credentials/${req.file.filename}`);
    res.status(400);
    throw new Error('issueDate is not a valid date');
  }

  if (expiryDate && new Date(expiryDate) < new Date(issueDate)) {
    if (req.file) removeStoredFile(`/uploads/credentials/${req.file.filename}`);
    res.status(400);
    throw new Error('expiryDate cannot be earlier than issueDate');
  }

  const credential = await Credential.create({
    user: req.user._id,
    title,
    issuer,
    credentialType,
    issueDate,
    expiryDate: expiryDate || null,
    fileUrl: req.file ? `/uploads/credentials/${req.file.filename}` : null,
    // ipfsHash / txHash intentionally left null - populated later once
    // the Blockchain / Decentralized Storage layers are integrated
  });

  credential.credentialHash = await computeCredentialHash(req, {
    title,
    issuer,
    credentialType,
    issueDate,
    user: req.user._id,
  });
  await credential.save();

  await notify({
    user: req.user._id,
    type: 'credential_submitted',
    title: 'Credential added to your passport',
    message: `"${credential.title}" was added and is awaiting verification.`,
    resource: { kind: 'credential', id: credential._id },
  });

  res.status(201).json({ success: true, data: credential });
});

// @desc    Get logged-in user's credentials
// @route   GET /api/credentials/me
// @access  Private
const getMyCredentials = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const query = { user: req.user._id };
  if (status) query.status = status;

  const credentials = await Credential.find(query).sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: credentials.length, data: credentials });
});

// @desc    Get any user's verified credentials (recruiter/mentor/admin view)
// @route   GET /api/credentials/user/:userId
// @access  Private
const getCredentialsByUser = asyncHandler(async (req, res) => {
  const credentials = await Credential.find({
    user: req.params.userId,
    status: 'verified',
  }).sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: credentials.length, data: credentials });
});

// @desc    Get single credential by ID
// @route   GET /api/credentials/:id
// @access  Private
const getCredentialById = asyncHandler(async (req, res) => {
  const credential = await Credential.findById(req.params.id).populate(
    'user',
    'name email role'
  );
  if (!credential) {
    res.status(404);
    throw new Error('Credential not found');
  }

  // A pending or rejected credential is only visible to its owner and to
  // the roles that are allowed to review it.
  const VIEWER_ROLES = ['educational_institution', 'mentor_industry_expert', 'administrator'];
  const isOwner = credential.user._id.toString() === req.user._id.toString();
  if (credential.status !== 'verified' && !isOwner && !VIEWER_ROLES.includes(req.user.role)) {
    res.status(403);
    throw new Error('Not authorized to view this credential');
  }

  res.status(200).json({ success: true, data: credential });
});

// @desc    Update own credential (only while pending)
// @route   PUT /api/credentials/:id
// @access  Private
const updateCredential = asyncHandler(async (req, res) => {
  const credential = await Credential.findById(req.params.id);
  if (!credential) {
    res.status(404);
    throw new Error('Credential not found');
  }
  if (credential.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to update this credential');
  }
  if (credential.status !== 'pending') {
    res.status(400);
    throw new Error('Only pending credentials can be edited');
  }

  const { title, issuer, credentialType, issueDate, expiryDate } = req.body;
  if (title) credential.title = title;
  if (issuer) credential.issuer = issuer;
  if (credentialType) credential.credentialType = credentialType;
  if (issueDate) credential.issueDate = issueDate;
  if (expiryDate !== undefined) credential.expiryDate = expiryDate;
  if (req.file) {
    removeStoredFile(credential.fileUrl);
    credential.fileUrl = `/uploads/credentials/${req.file.filename}`;
  }

  // Any edit changes the artefact, so the hash a verifier would compute
  // changes too - recompute it rather than leaving a stale digest behind.
  credential.credentialHash = await computeCredentialHash(req, {
    title: credential.title,
    issuer: credential.issuer,
    credentialType: credential.credentialType,
    issueDate: credential.issueDate,
    user: credential.user,
  });

  const updated = await credential.save();
  res.status(200).json({ success: true, data: updated });
});

// @desc    Delete own credential
// @route   DELETE /api/credentials/:id
// @access  Private
const deleteCredential = asyncHandler(async (req, res) => {
  const credential = await Credential.findById(req.params.id);
  if (!credential) {
    res.status(404);
    throw new Error('Credential not found');
  }
  if (
    credential.user.toString() !== req.user._id.toString() &&
    req.user.role !== 'administrator'
  ) {
    res.status(403);
    throw new Error('Not authorized to delete this credential');
  }

  await VerificationRequest.deleteMany({ credential: credential._id });
  removeStoredFile(credential.fileUrl);
  await credential.deleteOne();
  res.status(200).json({ success: true, message: 'Credential deleted successfully' });
});

module.exports = {
  createCredential,
  getMyCredentials,
  getCredentialsByUser,
  getCredentialById,
  updateCredential,
  deleteCredential,
};
