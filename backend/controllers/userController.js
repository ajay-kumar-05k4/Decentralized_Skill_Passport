const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Credential = require('../models/Credential');
const VerificationRequest = require('../models/VerificationRequest');
const Notification = require('../models/Notification');
const ShareLink = require('../models/ShareLink');
const Skill = require('../models/Skill');
const { ROLE_NAMES } = require('../models/Role');

// @desc    Get all users (with optional role filter, pagination)
// @route   GET /api/users
// @access  Private/Administrator
const getUsers = asyncHandler(async (req, res) => {
  const { role, search, page = 1, limit = 20 } = req.query;
  const query = {};

  if (role) query.role = role;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [users, total] = await Promise.all([
    User.find(query).skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
    User.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    count: users.length,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    data: users,
  });
});

// @desc    Get single user by ID
// @route   GET /api/users/:id
// @access  Private/Administrator
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  res.status(200).json({ success: true, data: user });
});

// @desc    Update a user's own basic info
// @route   PUT /api/users/me
// @access  Private
const updateMyProfile = asyncHandler(async (req, res) => {
  const { name, organization } = req.body;

  const user = await User.findById(req.user._id);
  if (name) user.name = name;
  if (organization !== undefined) user.organization = organization;

  const updated = await user.save();
  res.status(200).json({ success: true, data: updated.toSafeObject() });
});

// @desc    Admin: update any user (role, active status, etc.)
// @route   PUT /api/users/:id
// @access  Private/Administrator
const updateUser = asyncHandler(async (req, res) => {
  const { name, role, organization, isActive } = req.body;

  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (role && !ROLE_NAMES.includes(role)) {
    res.status(400);
    throw new Error(`Invalid role. Must be one of: ${ROLE_NAMES.join(', ')}`);
  }

  // An administrator must not be able to lock everyone out by demoting or
  // deactivating the last remaining administrator account.
  const demoting = role && role !== 'administrator' && user.role === 'administrator';
  const deactivating = isActive === false && user.role === 'administrator';
  if (demoting || deactivating) {
    const admins = await User.countDocuments({ role: 'administrator', isActive: true });
    if (admins <= 1) {
      res.status(400);
      throw new Error('Cannot demote or deactivate the last active administrator');
    }
  }

  if (name) user.name = name;
  if (role) user.role = role;
  if (organization !== undefined) user.organization = organization;
  if (isActive !== undefined) user.isActive = isActive;

  const updated = await user.save();
  res.status(200).json({ success: true, data: updated.toSafeObject() });
});

// @desc    Admin: delete a user and everything that belongs to them
// @route   DELETE /api/users/:id
// @access  Private/Administrator
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (user._id.toString() === req.user._id.toString()) {
    res.status(400);
    throw new Error('You cannot delete your own account');
  }

  // Cascade: without this the DB fills up with profiles, credentials and
  // verification requests pointing at a user that no longer exists.
  const credentials = await Credential.find({ user: user._id }).select('_id');
  const credentialIds = credentials.map((c) => c._id);

  await VerificationRequest.deleteMany({
    $or: [{ requestedBy: user._id }, { credential: { $in: credentialIds } }],
  });
  await Credential.deleteMany({ user: user._id });
  await Notification.deleteMany({ user: user._id });
  await ShareLink.deleteMany({ user: user._id });
  await Profile.deleteOne({ user: user._id });
  await user.deleteOne();

  res.status(200).json({ success: true, message: 'User deleted successfully' });
});

// @desc    Get available roles
// @route   GET /api/users/roles/list
// @access  Private
const listRoles = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: ROLE_NAMES });
});

// @desc    Platform-wide counts for the admin dashboard
// @route   GET /api/users/stats/overview
// @access  Private/Administrator
const getPlatformStats = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    activeUsers,
    identityVerifiedUsers,
    totalSkills,
    totalCredentials,
    verifiedCredentials,
    pendingCredentials,
    rejectedCredentials,
    pendingRequests,
    inReviewRequests,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ identityHash: { $ne: null } }),
    Skill.countDocuments({}),
    Credential.countDocuments({}),
    Credential.countDocuments({ status: 'verified' }),
    Credential.countDocuments({ status: 'pending' }),
    Credential.countDocuments({ status: 'rejected' }),
    VerificationRequest.countDocuments({ status: 'pending' }),
    VerificationRequest.countDocuments({ status: 'in_review' }),
  ]);

  const usersByRole = {};
  await Promise.all(
    ROLE_NAMES.map(async (role) => {
      usersByRole[role] = await User.countDocuments({ role });
    })
  );

  res.status(200).json({
    success: true,
    data: {
      users: { total: totalUsers, active: activeUsers, identityVerified: identityVerifiedUsers, byRole: usersByRole },
      skills: { total: totalSkills },
      credentials: {
        total: totalCredentials,
        verified: verifiedCredentials,
        pending: pendingCredentials,
        rejected: rejectedCredentials,
      },
      verificationQueue: { pending: pendingRequests, inReview: inReviewRequests },
      generatedAt: new Date(),
    },
  });
});

module.exports = {
  getUsers,
  getPlatformStats,
  getUserById,
  updateMyProfile,
  updateUser,
  deleteUser,
  listRoles,
};
