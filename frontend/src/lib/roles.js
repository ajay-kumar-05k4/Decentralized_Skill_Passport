export const ROLES = {
  learner: 'learner',
  institution: 'educational_institution',
  employer: 'employer_recruiter',
  mentor: 'mentor_industry_expert',
  admin: 'administrator',
};

export const ROLE_LABELS = {
  learner: 'Learner',
  educational_institution: 'Educational institution',
  employer_recruiter: 'Employer / recruiter',
  mentor_industry_expert: 'Mentor / industry expert',
  administrator: 'Administrator',
};

export const SELF_ASSIGNABLE_ROLES = [
  'learner',
  'educational_institution',
  'employer_recruiter',
  'mentor_industry_expert',
];

export const isVerifier = (role) =>
  ['educational_institution', 'mentor_industry_expert', 'administrator'].includes(role);

export const canEndorse = (role) =>
  ['mentor_industry_expert', 'employer_recruiter', 'administrator'].includes(role);

export const canViewPassports = (role) =>
  [
    'employer_recruiter',
    'educational_institution',
    'mentor_industry_expert',
    'administrator',
  ].includes(role);

export const canManageSkills = (role) =>
  ['administrator', 'educational_institution'].includes(role);
