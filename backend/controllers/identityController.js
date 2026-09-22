const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { buildIdentityHash, safeEqual } = require('../utils/hash');

// @desc    Register the learner's decentralized identity anchor
// @route   POST /api/identity/me
// @access  Private
//
// The learner supplies a government identity number (Aadhaar, passport, ...)
// and a secret phrase only they know. We store nothing but the SHA-256 digest
// of the pair, so neither value is recoverable from the database. The digest
// is returned once - the learner must keep it, because it is what they hand
// to a verifier later.
const registerIdentity = asyncHandler(async (req, res) => {
  const { uniqueIdNumber, secretPhrase } = req.body;

  if (!uniqueIdNumber || !secretPhrase) {
    res.status(400);
    throw new Error('uniqueIdNumber and secretPhrase are both required');
  }
  if (String(uniqueIdNumber).trim().length < 6) {
    res.status(400);
    throw new Error('uniqueIdNumber must be at least 6 characters');
  }
  if (String(secretPhrase).length < 8) {
    res.status(400);
    throw new Error('secretPhrase must be at least 8 characters');
  }

  const user = await User.findById(req.user._id);
  if (user.identityHash) {
    res.status(409);
    throw new Error(
      'An identity is already registered for this account. Reset it first if you need to change it.'
    );
  }

  const identityHash = buildIdentityHash(uniqueIdNumber, secretPhrase);

  // Two accounts must not resolve to the same identity - that would break the
  // student-to-certificate linkage check.
  const clash = await User.findOne({ identityHash });
  if (clash) {
    res.status(409);
    throw new Error('This identity is already registered to another account');
  }

  user.identityHash = identityHash;
  user.identitySetAt = new Date();
  await user.save();

  res.status(201).json({
    success: true,
    message:
      'Identity registered. Store this hash safely - it is shown once and is required for verification.',
    data: { identityHash, identitySetAt: user.identitySetAt },
  });
});

// @desc    Identity registration status (never returns the hash again)
// @route   GET /api/identity/me
// @access  Private
const getIdentityStatus = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      registered: Boolean(req.user.identityHash),
      identitySetAt: req.user.identitySetAt,
    },
  });
});

// @desc    Prove ownership of the registered identity
// @route   POST /api/identity/me/confirm
// @access  Private
//
// Lets a learner who lost their hash recompute and recover it by re-entering
// the original identity number and secret phrase.
const confirmIdentity = asyncHandler(async (req, res) => {
  const { uniqueIdNumber, secretPhrase } = req.body;

  if (!uniqueIdNumber || !secretPhrase) {
    res.status(400);
    throw new Error('uniqueIdNumber and secretPhrase are both required');
  }

  const user = await User.findById(req.user._id);
  if (!user.identityHash) {
    res.status(404);
    throw new Error('No identity registered for this account');
  }

  const candidate = buildIdentityHash(uniqueIdNumber, secretPhrase);
  if (!safeEqual(candidate, user.identityHash)) {
    res.status(401);
    throw new Error('The details provided do not match the registered identity');
  }

  res.status(200).json({ success: true, data: { identityHash: user.identityHash } });
});

// @desc    Reset the identity anchor (requires the current details)
// @route   PUT /api/identity/me
// @access  Private
const resetIdentity = asyncHandler(async (req, res) => {
  const { uniqueIdNumber, secretPhrase, newSecretPhrase } = req.body;

  if (!uniqueIdNumber || !secretPhrase || !newSecretPhrase) {
    res.status(400);
    throw new Error('uniqueIdNumber, secretPhrase and newSecretPhrase are all required');
  }
  if (String(newSecretPhrase).length < 8) {
    res.status(400);
    throw new Error('newSecretPhrase must be at least 8 characters');
  }

  const user = await User.findById(req.user._id);
  if (!user.identityHash) {
    res.status(404);
    throw new Error('No identity registered for this account');
  }

  if (!safeEqual(buildIdentityHash(uniqueIdNumber, secretPhrase), user.identityHash)) {
    res.status(401);
    throw new Error('The details provided do not match the registered identity');
  }

  user.identityHash = buildIdentityHash(uniqueIdNumber, newSecretPhrase);
  user.identitySetAt = new Date();
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Identity reset. Previously shared hashes no longer verify.',
    data: { identityHash: user.identityHash, identitySetAt: user.identitySetAt },
  });
});

module.exports = { registerIdentity, getIdentityStatus, confirmIdentity, resetIdentity };
