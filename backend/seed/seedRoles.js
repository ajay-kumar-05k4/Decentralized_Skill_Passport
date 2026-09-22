// One-time script to populate the Role collection with the 5 stakeholder
// roles from the system architecture. Run with: npm run seed
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Role = require('../models/Role');
const Skill = require('../models/Skill');

const roles = [
  { name: 'learner', description: 'End user building and showcasing their skill passport', permissions: ['profile:read', 'profile:write', 'credential:write'] },
  { name: 'educational_institution', description: 'Issues and verifies academic credentials', permissions: ['credential:verify', 'skill:write'] },
  { name: 'employer_recruiter', description: 'Views verified profiles and matches talent', permissions: ['profile:read', 'skill:endorse'] },
  { name: 'mentor_industry_expert', description: 'Endorses skills and verifies credentials', permissions: ['skill:endorse', 'credential:verify'] },
  { name: 'administrator', description: 'Manages users, roles, and platform data', permissions: ['*'] },
];

// A small starter set so the skills dropdown isn't empty on a fresh install
const skills = [
  { name: 'JavaScript', category: 'programming' },
  { name: 'Python', category: 'programming' },
  { name: 'React.js', category: 'frontend' },
  { name: 'Node.js', category: 'backend' },
  { name: 'MongoDB', category: 'database' },
  { name: 'Solidity', category: 'blockchain' },
  { name: 'Machine Learning', category: 'ai' },
  { name: 'Data Analysis', category: 'ai' },
  { name: 'Communication', category: 'soft-skills' },
  { name: 'Project Management', category: 'soft-skills' },
];

(async () => {
  await connectDB();

  for (const role of roles) {
    await Role.findOneAndUpdate({ name: role.name }, role, { upsert: true, new: true });
  }
  console.log(`Roles seeded: ${roles.length}`);

  for (const skill of skills) {
    await Skill.findOneAndUpdate({ name: skill.name }, skill, { upsert: true, new: true });
  }
  console.log(`Skills seeded: ${skills.length}`);

  await mongoose.connection.close();
  process.exit(0);
})();
