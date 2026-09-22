const asyncHandler = require('express-async-handler');
const Skill = require('../models/Skill');
const Profile = require('../models/Profile');

// @desc    Create a new skill (master list)
// @route   POST /api/skills
// @access  Private/Administrator/Educational_Institution
const createSkill = asyncHandler(async (req, res) => {
  const { name, category, description } = req.body;

  if (!name || !String(name).trim()) {
    res.status(400);
    throw new Error('Skill name is required');
  }

  const trimmed = String(name).trim();

  // Case-insensitive duplicate check so "React" and "react" don't both exist
  const exists = await Skill.findOne({ name: { $regex: `^${escapeRegex(trimmed)}$`, $options: 'i' } });
  if (exists) {
    res.status(400);
    throw new Error('Skill already exists');
  }

  const skill = await Skill.create({ name: trimmed, category, description });
  res.status(201).json({ success: true, data: skill });
});

// @desc    Get all skills (search/filter by category)
// @route   GET /api/skills
// @access  Private
const getSkills = asyncHandler(async (req, res) => {
  const { search, category } = req.query;
  const query = {};
  if (search) query.name = { $regex: escapeRegex(search), $options: 'i' };
  if (category) query.category = category;

  const skills = await Skill.find(query).sort({ name: 1 });
  res.status(200).json({ success: true, count: skills.length, data: skills });
});

// @desc    Get a single skill
// @route   GET /api/skills/:id
// @access  Private
const getSkillById = asyncHandler(async (req, res) => {
  const skill = await Skill.findById(req.params.id);
  if (!skill) {
    res.status(404);
    throw new Error('Skill not found');
  }
  res.status(200).json({ success: true, data: skill });
});

// @desc    Delete a skill
// @route   DELETE /api/skills/:id
// @access  Private/Administrator
const deleteSkill = asyncHandler(async (req, res) => {
  const skill = await Skill.findById(req.params.id);
  if (!skill) {
    res.status(404);
    throw new Error('Skill not found');
  }

  // Pull the skill off every profile that references it, otherwise those
  // profiles keep a dangling reference that populate() resolves to null.
  const affected = await Profile.find({ 'skills.skill': skill._id });
  for (const profile of affected) {
    profile.skills = profile.skills.filter((s) => s.skill.toString() !== skill._id.toString());
    await profile.save();
  }

  await skill.deleteOne();

  res.status(200).json({ success: true, message: 'Skill deleted successfully' });
});

// User input goes into a $regex, so metacharacters must be neutralised
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { createSkill, getSkills, getSkillById, deleteSkill };
