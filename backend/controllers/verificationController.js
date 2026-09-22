const asyncHandler = require('express-async-handler');
const Credential = require('../models/Credential');
const VerificationRequest = require('../models/VerificationRequest');
const { notify } = require('../utils/notify');

// @desc    Submit a credential for verification
// @route   POST /api/verifications
// @access  Private
const requestVerification = asyncHandler(async (req, res) => {
  const { credentialId } = req.body;

  if (!credentialId) {
    res.status(400);
    throw new Error('credentialId is required');
  }

  const credential = await Credential.findById(credentialId);
  if (!credential) {
    res.status(404);
    throw new Error('Credential not found');
  }
  if (credential.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to request verification for this credential');
  }
  if (credential.status === 'verified') {
    res.status(400);
    throw new Error('This credential has already been verified');
  }

  const existing = await VerificationRequest.findOne({
    credential: credentialId,
    status: { $in: ['pending', 'in_review'] },
  });
  if (existing) {
    res.status(400);
    throw new Error('A verification request is already in progress for this credential');
  }

  const request = await VerificationRequest.create({
    credential: credentialId,
    requestedBy: req.user._id,
  });

  // Re-submitting a previously rejected credential puts it back in the queue
  if (credential.status === 'rejected') {
    credential.status = 'pending';
    await credential.save();
  }

  await notify({
    user: req.user._id,
    type: 'verification_requested',
    title: 'Verification requested',
    message: `"${credential.title}" has been submitted to the verification queue.`,
    resource: { kind: 'verification', id: request._id },
  });

  res.status(201).json({ success: true, data: request });
});

// @desc    Get verification requests (queue) - verifiers/admins
// @route   GET /api/verifications
// @access  Private/Educational_Institution/Mentor_Industry_Expert/Administrator
const getVerificationRequests = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const query = {};
  if (status) query.status = status;

  const requests = await VerificationRequest.find(query)
    .populate('credential')
    .populate('requestedBy', 'name email role')
    .populate('verifier', 'name email role')
    .sort({ createdAt: -1 });

  res.status(200).json({ success: true, count: requests.length, data: requests });
});

// @desc    Get logged-in user's own submitted verification requests
// @route   GET /api/verifications/me
// @access  Private
const getMyVerificationRequests = asyncHandler(async (req, res) => {
  const requests = await VerificationRequest.find({ requestedBy: req.user._id })
    .populate('credential')
    .populate('verifier', 'name email role')
    .sort({ createdAt: -1 });

  res.status(200).json({ success: true, count: requests.length, data: requests });
});

// @desc    Verifier claims a pending request for review
// @route   PUT /api/verifications/:id/claim
// @access  Private/Educational_Institution/Mentor_Industry_Expert/Administrator
const claimVerification = asyncHandler(async (req, res) => {
  const request = await VerificationRequest.findById(req.params.id);
  if (!request) {
    res.status(404);
    throw new Error('Verification request not found');
  }
  if (request.status !== 'pending') {
    res.status(400);
    throw new Error('Only pending requests can be claimed');
  }

  request.status = 'in_review';
  request.verifier = req.user._id;
  await request.save();

  await notify({
    user: request.requestedBy,
    type: 'verification_claimed',
    title: 'Your credential is under review',
    message: `${req.user.name} has picked up your verification request.`,
    resource: { kind: 'verification', id: request._id },
  });

  res.status(200).json({ success: true, data: request });
});

// @desc    Verifier approves or rejects a credential
// @route   PUT /api/verifications/:id/decision
// @access  Private/Educational_Institution/Mentor_Industry_Expert/Administrator
const decideVerification = asyncHandler(async (req, res) => {
  const { decision, comments } = req.body; // decision: 'approved' | 'rejected'

  if (!['approved', 'rejected'].includes(decision)) {
    res.status(400);
    throw new Error("decision must be 'approved' or 'rejected'");
  }

  const request = await VerificationRequest.findById(req.params.id).populate('credential');
  if (!request) {
    res.status(404);
    throw new Error('Verification request not found');
  }
  if (!['pending', 'in_review'].includes(request.status)) {
    res.status(400);
    throw new Error('This request has already been finalized');
  }

  // A verifier who already claimed the request owns it until it is decided
  if (
    request.verifier &&
    request.verifier.toString() !== req.user._id.toString() &&
    req.user.role !== 'administrator'
  ) {
    res.status(403);
    throw new Error('This request is being reviewed by another verifier');
  }

  // A learner must never be able to approve their own credential, even if
  // they also hold a verifier role.
  if (request.requestedBy.toString() === req.user._id.toString()) {
    res.status(403);
    throw new Error('You cannot decide on your own verification request');
  }

  if (!request.credential) {
    res.status(404);
    throw new Error('The credential for this request no longer exists');
  }

  request.status = decision;
  request.comments = comments || '';
  request.verifiedAt = new Date();
  if (!request.verifier) request.verifier = req.user._id;
  await request.save();

  const credential = await Credential.findById(request.credential._id);
  credential.status = decision === 'approved' ? 'verified' : 'rejected';
  await credential.save();
  // Note: on-chain anchoring (txHash) / IPFS pinning of the verified
  // credential will be wired up once the Blockchain layer is integrated.

  await notify({
    user: request.requestedBy,
    type: decision === 'approved' ? 'verification_approved' : 'verification_rejected',
    title:
      decision === 'approved' ? 'Credential verified' : 'Credential verification rejected',
    message:
      decision === 'approved'
        ? `"${credential.title}" is now a verified entry on your passport.`
        : `"${credential.title}" was not verified.${comments ? ` Reason: ${comments}` : ''}`,
    resource: { kind: 'credential', id: credential._id },
  });

  res.status(200).json({ success: true, data: { request, credential } });
});

module.exports = {
  requestVerification,
  getVerificationRequests,
  getMyVerificationRequests,
  claimVerification,
  decideVerification,
};
