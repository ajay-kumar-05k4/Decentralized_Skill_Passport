const mongoose = require('mongoose');

// Matches "User / Stakeholder Layer" from the system architecture
const ROLE_NAMES = [
  'learner',
  'educational_institution',
  'employer_recruiter',
  'mentor_industry_expert',
  'administrator',
];

// Roles a visitor may pick for themselves at POST /api/auth/register.
// 'administrator' is deliberately excluded - it can only be granted by an
// existing administrator via PUT /api/users/:id.
const SELF_ASSIGNABLE_ROLES = ROLE_NAMES.filter((r) => r !== 'administrator');

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, enum: ROLE_NAMES },
    permissions: { type: [String], default: [] },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Role', roleSchema);
module.exports.ROLE_NAMES = ROLE_NAMES;
module.exports.SELF_ASSIGNABLE_ROLES = SELF_ASSIGNABLE_ROLES;
