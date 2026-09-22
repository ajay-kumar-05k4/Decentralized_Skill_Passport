const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Credential = require('../models/Credential');
const ShareLink = require('../models/ShareLink');
const { randomToken } = require('../utils/hash');
const { notify } = require('../utils/notify');

// Assembles the Digital Skill Passport: identity anchor + profile +
// verified credentials + achievements, in one payload the frontend can render
// and an authorized organization can check.
const buildPassport = async (userId, { includeCredentials = true, includeContact = true } = {}) => {
  const [user, profile] = await Promise.all([
    User.findById(userId),
    Profile.findOne({ user: userId }).populate({ path: 'skills.skill', select: 'name category' }),
  ]);

  if (!user) return null;

  const credentials = includeCredentials
    ? await Credential.find({ user: userId, status: 'verified' }).sort({ issueDate: -1 })
    : [];

  const skills = (profile?.skills || []).map((entry) => ({
    name: entry.skill ? entry.skill.name : null,
    category: entry.skill ? entry.skill.category : null,
    proficiency: entry.proficiency,
    endorsements: entry.endorsedBy.length,
  }));

  return {
    holder: {
      name: user.name,
      headline: profile?.headline || '',
      location: profile?.location || '',
      bio: profile?.bio || '',
      role: user.role,
      organization: user.organization,
      ...(includeContact ? { email: user.email } : {}),
      identityVerified: Boolean(user.identityHash),
      memberSince: user.createdAt,
    },
    skills,
    credentials: credentials.map((c) => ({
      title: c.title,
      issuer: c.issuer,
      credentialType: c.credentialType,
      issueDate: c.issueDate,
      expiryDate: c.expiryDate,
      credentialHash: c.credentialHash,
      // Present once the Blockchain / IPFS layers are wired in
      ipfsHash: c.ipfsHash,
      txHash: c.txHash,
    })),
    education: profile?.education || [],
    experience: profile?.experience || [],
    projects: profile?.projects || [],
    internships: profile?.internships || [],
    research: profile?.research || [],
    insights: {
      // Left null until the Python AI layer is connected
      employabilityScore: profile?.employabilityScore ?? null,
      skillGaps: null,
      learningRecommendations: null,
    },
    summary: {
      totalSkills: skills.length,
      totalEndorsements: skills.reduce((sum, s) => sum + s.endorsements, 0),
      verifiedCredentials: credentials.length,
      projects: profile?.projects?.length || 0,
      internships: profile?.internships?.length || 0,
      research: profile?.research?.length || 0,
    },
    generatedAt: new Date(),
  };
};

// @desc    The logged-in learner's own passport
// @route   GET /api/passport/me
// @access  Private
const getMyPassport = asyncHandler(async (req, res) => {
  const passport = await buildPassport(req.user._id);
  res.status(200).json({ success: true, data: passport });
});

// @desc    Another user's passport (recruiters, institutions, admins)
// @route   GET /api/passport/user/:userId
// @access  Private
const getPassportByUser = asyncHandler(async (req, res) => {
  const passport = await buildPassport(req.params.userId, { includeContact: false });
  if (!passport) {
    res.status(404);
    throw new Error('User not found');
  }
  res.status(200).json({ success: true, data: passport });
});

// @desc    Create a shareable, revocable passport link
// @route   POST /api/passport/share
// @access  Private
const createShareLink = asyncHandler(async (req, res) => {
  const { label, expiresInDays, includeCredentials = true, includeContact = false } = req.body;

  if (
    expiresInDays !== undefined &&
    (Number(expiresInDays) <= 0 || Number.isNaN(Number(expiresInDays)))
  ) {
    res.status(400);
    throw new Error('expiresInDays must be a positive number');
  }

  const activeCount = await ShareLink.countDocuments({
    user: req.user._id,
    revokedAt: null,
  });
  if (activeCount >= 20) {
    res.status(400);
    throw new Error('You already have 20 active share links. Revoke one before creating another.');
  }

  const link = await ShareLink.create({
    user: req.user._id,
    token: randomToken(),
    label: label || '',
    includeCredentials: Boolean(includeCredentials),
    includeContact: Boolean(includeContact),
    expiresAt: expiresInDays
      ? new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000)
      : null,
  });

  await notify({
    user: req.user._id,
    type: 'passport_shared',
    title: 'Passport share link created',
    message: label ? `Share link "${label}" is now active.` : 'A new share link is now active.',
  });

  res.status(201).json({ success: true, data: link });
});

// @desc    List the caller's share links
// @route   GET /api/passport/share
// @access  Private
const listShareLinks = asyncHandler(async (req, res) => {
  const links = await ShareLink.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: links.length, data: links });
});

// @desc    Revoke a share link
// @route   DELETE /api/passport/share/:token
// @access  Private
const revokeShareLink = asyncHandler(async (req, res) => {
  const link = await ShareLink.findOne({ token: req.params.token });
  if (!link) {
    res.status(404);
    throw new Error('Share link not found');
  }
  if (link.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to revoke this share link');
  }
  if (link.revokedAt) {
    res.status(400);
    throw new Error('This share link is already revoked');
  }

  link.revokedAt = new Date();
  await link.save();

  res.status(200).json({ success: true, message: 'Share link revoked' });
});

// @desc    Read a shared passport - no account needed
// @route   GET /api/passport/shared/:token
// @access  Public
const getSharedPassport = asyncHandler(async (req, res) => {
  const link = await ShareLink.findOne({ token: req.params.token });

  // Same response for "never existed", "revoked" and "expired" so the endpoint
  // can't be used to probe which tokens were once real.
  if (!link || !link.isUsable()) {
    res.status(404);
    throw new Error('This share link is invalid, expired, or has been revoked');
  }

  const passport = await buildPassport(link.user, {
    includeCredentials: link.includeCredentials,
    includeContact: link.includeContact,
  });
  if (!passport) {
    res.status(404);
    throw new Error('This share link is invalid, expired, or has been revoked');
  }

  link.viewCount += 1;
  link.lastViewedAt = new Date();
  await link.save();

  res.status(200).json({ success: true, data: passport });
});

module.exports = {
  buildPassport,
  getMyPassport,
  getPassportByUser,
  createShareLink,
  listShareLinks,
  revokeShareLink,
  getSharedPassport,
};
