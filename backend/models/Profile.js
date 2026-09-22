const mongoose = require('mongoose');

const skillEntrySchema = new mongoose.Schema(
  {
    skill: { type: mongoose.Schema.Types.ObjectId, ref: 'Skill', required: true },
    proficiency: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      default: 'beginner',
    },
    endorsedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { _id: false }
);

const educationSchema = new mongoose.Schema(
  { institution: String, degree: String, fieldOfStudy: String, startYear: Number, endYear: Number },
  { _id: false }
);

const experienceSchema = new mongoose.Schema(
  { company: String, title: String, description: String, startDate: Date, endDate: Date },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    role: String,
    technologies: [String],
    url: String,
    startDate: Date,
    endDate: Date,
  },
  { _id: false }
);

const internshipSchema = new mongoose.Schema(
  {
    organization: String,
    role: String,
    description: String,
    startDate: Date,
    endDate: Date,
  },
  { _id: false }
);

const researchSchema = new mongoose.Schema(
  {
    title: String,
    venue: String,
    year: Number,
    doi: String,
    url: String,
  },
  { _id: false }
);

const profileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    bio: { type: String, default: '', maxlength: 1000 },
    headline: { type: String, default: '' },
    location: { type: String, default: '' },
    skills: [skillEntrySchema],
    education: [educationSchema],
    experience: [experienceSchema],
    // The Digital Skill Passport covers more than certificates: projects,
    // internships and research contributions are first-class entries too.
    projects: [projectSchema],
    internships: [internshipSchema],
    research: [researchSchema],
    // Populated later by the AI layer (Skill Gap / Employability Assessment)
    employabilityScore: { type: Number, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Profile', profileSchema);
