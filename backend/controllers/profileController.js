const asyncHandler = require('express-async-handler');
const Profile = require('../models/Profile');
const Skill = require('../models/Skill');
const { notify } = require('../utils/notify');

const POPULATE = [
  { path: 'user', select: 'name email role organization' },
  { path: 'skills.skill', select: 'name category' },
];

// @desc    Get logged-in user's profile
// @route   GET /api/profiles/me
// @access  Private
const getMyProfile = asyncHandler(async (req, res) => {
  let profile = await Profile.findOne({ user: req.user._id }).populate(POPULATE);
  if (!profile) {
    profile = await Profile.create({ user: req.user._id });
    profile = await profile.populate(POPULATE);
  }
  res.status(200).json({ success: true, data: profile });
});

// @desc    Get any user's public profile by user ID
// @route   GET /api/profiles/:userId
// @access  Private
const getProfileByUserId = asyncHandler(async (req, res) => {
  const profile = await Profile.findOne({ user: req.params.userId }).populate(POPULATE);
  if (!profile) {
    res.status(404);
    throw new Error('Profile not found');
  }
  res.status(200).json({ success: true, data: profile });
});

// @desc    Update bio/headline/location/education/experience
// @route   PUT /api/profiles/me
// @access  Private
const updateMyProfile = asyncHandler(async (req, res) => {
  const { bio, headline, location, education, experience, projects, internships, research } =
    req.body;

  let profile = await Profile.findOne({ user: req.user._id });
  if (!profile) profile = new Profile({ user: req.user._id });

  if (bio !== undefined) profile.bio = bio;
  if (headline !== undefined) profile.headline = headline;
  if (location !== undefined) profile.location = location;
  if (Array.isArray(education)) profile.education = education;
  if (Array.isArray(experience)) profile.experience = experience;
  // Passport sections beyond the CV basics
  if (Array.isArray(projects)) profile.projects = projects;
  if (Array.isArray(internships)) profile.internships = internships;
  if (Array.isArray(research)) profile.research = research;

  await profile.save();
  const populated = await profile.populate(POPULATE);
  res.status(200).json({ success: true, data: populated });
});

// @desc    Add or update a skill entry on the profile
// @route   POST /api/profiles/me/skills
// @access  Private
const addSkillToProfile = asyncHandler(async (req, res) => {
  const { skillId, proficiency } = req.body;

  if (!skillId) {
    res.status(400);
    throw new Error('skillId is required');
  }

  const VALID_PROFICIENCY = ['beginner', 'intermediate', 'advanced', 'expert'];
  if (proficiency && !VALID_PROFICIENCY.includes(proficiency)) {
    res.status(400);
    throw new Error(`proficiency must be one of: ${VALID_PROFICIENCY.join(', ')}`);
  }

  const skill = await Skill.findById(skillId);
  if (!skill) {
    res.status(404);
    throw new Error('Skill not found');
  }

  let profile = await Profile.findOne({ user: req.user._id });
  if (!profile) profile = new Profile({ user: req.user._id });

  const existingEntry = profile.skills.find((s) => s.skill.toString() === skillId);
  if (existingEntry) {
    existingEntry.proficiency = proficiency || existingEntry.proficiency;
  } else {
    profile.skills.push({ skill: skillId, proficiency: proficiency || 'beginner' });
  }

  await profile.save();
  const populated = await profile.populate(POPULATE);
  res.status(200).json({ success: true, data: populated });
});

// @desc    Remove a skill from the profile
// @route   DELETE /api/profiles/me/skills/:skillId
// @access  Private
const removeSkillFromProfile = asyncHandler(async (req, res) => {
  const profile = await Profile.findOne({ user: req.user._id });
  if (!profile) {
    res.status(404);
    throw new Error('Profile not found');
  }

  const before = profile.skills.length;
  profile.skills = profile.skills.filter((s) => s.skill.toString() !== req.params.skillId);
  if (profile.skills.length === before) {
    res.status(404);
    throw new Error('Skill not found on this profile');
  }

  await profile.save();
  const populated = await profile.populate(POPULATE);
  res.status(200).json({ success: true, data: populated });
});

// @desc    Mentor/Employer endorses a skill on another user's profile
// @route   POST /api/profiles/:userId/skills/:skillId/endorse
// @access  Private/Mentor_Industry_Expert/Employer_Recruiter/Administrator
const endorseSkill = asyncHandler(async (req, res) => {
  if (req.params.userId === req.user._id.toString()) {
    res.status(400);
    throw new Error('You cannot endorse your own skills');
  }

  const profile = await Profile.findOne({ user: req.params.userId });
  if (!profile) {
    res.status(404);
    throw new Error('Profile not found');
  }

  const entry = profile.skills.find((s) => s.skill.toString() === req.params.skillId);
  if (!entry) {
    res.status(404);
    throw new Error('Skill not found on this profile');
  }

  const alreadyEndorsed = entry.endorsedBy.some(
    (id) => id.toString() === req.user._id.toString()
  );
  if (!alreadyEndorsed) {
    entry.endorsedBy.push(req.user._id);
    const skill = await Skill.findById(req.params.skillId).select('name');
    await notify({
      user: req.params.userId,
      type: 'skill_endorsed',
      title: 'A skill on your passport was endorsed',
      message: `${req.user.name} endorsed your ${skill ? skill.name : 'skill'}.`,
      resource: { kind: 'profile', id: profile._id },
    });
  }

  await profile.save();
  const populated = await profile.populate(POPULATE);
  res.status(200).json({ success: true, data: populated });
});

module.exports = {
  getMyProfile,
  getProfileByUserId,
  updateMyProfile,
  addSkillToProfile,
  removeSkillFromProfile,
  endorseSkill,
};
