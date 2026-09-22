const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Credential = require('../models/Credential');
const { isSha256Hex } = require('../utils/hash');

// PUBLIC verification desk.
//
// A recruiter or admissions officer must be able to verify a candidate
// WITHOUT holding an account - they are a third party, not a platform user.
// Every endpoint here therefore takes no authentication and accepts only
// opaque SHA-256 digests, so nothing identifying is exposed by the API.
//
// The flow mirrors the three checks the literature calls for:
//   1. identity  - is this a real, registered learner?
//   2. credential - does this certificate exist and is it verified?
//   3. linkage   - was that certificate actually issued to that learner?
// Steps 1 and 2 passing individually is not enough; step 3 is what stops a
// valid certificate being presented by someone it does not belong to.

const requireHash = (res, value, label) => {
  if (!value) {
    res.status(400);
    throw new Error(`${label} is required`);
  }
  if (!isSha256Hex(value)) {
    res.status(400);
    throw new Error(`${label} must be a 64-character SHA-256 hex digest`);
  }
  return String(value).toLowerCase();
};

// @desc    Step 1 - does this identity hash belong to an active learner?
// @route   POST /api/verify/identity
// @access  Public
const verifyIdentity = asyncHandler(async (req, res) => {
  const identityHash = requireHash(res, req.body.identityHash, 'identityHash');

  const user = await User.findOne({ identityHash, isActive: true });

  res.status(200).json({
    success: true,
    data: {
      step: 'identity',
      valid: Boolean(user),
      // Deliberately minimal: a verifier learns that the holder is genuine,
      // not their email, role or anything else about them.
      holderName: user ? user.name : null,
      registeredAt: user ? user.identitySetAt : null,
    },
  });
});

// @desc    Step 2 - does this credential hash exist and is it verified?
// @route   POST /api/verify/credential
// @access  Public
const verifyCredential = asyncHandler(async (req, res) => {
  const credentialHash = requireHash(res, req.body.credentialHash, 'credentialHash');

  const credential = await Credential.findOne({ credentialHash });
  const valid = Boolean(credential) && credential.status === 'verified';

  res.status(200).json({
    success: true,
    data: {
      step: 'credential',
      valid,
      found: Boolean(credential),
      status: credential ? credential.status : null,
      title: valid ? credential.title : null,
      issuer: valid ? credential.issuer : null,
      credentialType: valid ? credential.credentialType : null,
      issueDate: valid ? credential.issueDate : null,
      expiryDate: valid ? credential.expiryDate : null,
      expired: valid && credential.expiryDate ? credential.expiryDate < new Date() : false,
    },
  });
});

// @desc    Step 3 - was this credential issued to this identity?
// @route   POST /api/verify/linkage
// @access  Public
const verifyLinkage = asyncHandler(async (req, res) => {
  const identityHash = requireHash(res, req.body.identityHash, 'identityHash');
  const credentialHash = requireHash(res, req.body.credentialHash, 'credentialHash');

  const user = await User.findOne({ identityHash, isActive: true });
  const credential = await Credential.findOne({ credentialHash });

  const linked =
    Boolean(user) &&
    Boolean(credential) &&
    credential.user.toString() === user._id.toString();

  res.status(200).json({
    success: true,
    data: {
      step: 'linkage',
      valid: linked && credential.status === 'verified',
      identityValid: Boolean(user),
      credentialValid: Boolean(credential) && credential.status === 'verified',
      linked,
    },
  });
});

// @desc    All three checks in one call
// @route   POST /api/verify/full
// @access  Public
const verifyFull = asyncHandler(async (req, res) => {
  const identityHash = requireHash(res, req.body.identityHash, 'identityHash');
  const credentialHash = requireHash(res, req.body.credentialHash, 'credentialHash');

  const user = await User.findOne({ identityHash, isActive: true });
  const credential = await Credential.findOne({ credentialHash });

  const identityValid = Boolean(user);
  const credentialValid = Boolean(credential) && credential.status === 'verified';
  const linked =
    identityValid && Boolean(credential) && credential.user.toString() === user._id.toString();
  const valid = identityValid && credentialValid && linked;

  res.status(200).json({
    success: true,
    data: {
      valid,
      checks: {
        identity: identityValid,
        credential: credentialValid,
        linkage: linked,
      },
      holderName: valid ? user.name : null,
      credential: valid
        ? {
            title: credential.title,
            issuer: credential.issuer,
            credentialType: credential.credentialType,
            issueDate: credential.issueDate,
            expiryDate: credential.expiryDate,
          }
        : null,
      verifiedAt: new Date(),
      message: valid
        ? 'Holder and credential are both genuine, and the credential belongs to this holder.'
        : 'Verification failed. See the individual checks for which step did not pass.',
    },
  });
});

module.exports = { verifyIdentity, verifyCredential, verifyLinkage, verifyFull };
