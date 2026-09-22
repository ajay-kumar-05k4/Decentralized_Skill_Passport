const mongoose = require('mongoose');

// A revocable, optionally expiring link that lets a recruiter view a
// learner's Digital Skill Passport without an account. The learner stays in
// control: they choose what the link exposes and can revoke it at any time.
const shareLinkSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    label: { type: String, default: '' },
    includeCredentials: { type: Boolean, default: true },
    includeContact: { type: Boolean, default: false },
    expiresAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    viewCount: { type: Number, default: 0 },
    lastViewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

shareLinkSchema.methods.isUsable = function isUsable() {
  if (this.revokedAt) return false;
  if (this.expiresAt && this.expiresAt.getTime() < Date.now()) return false;
  return true;
};

module.exports = mongoose.model('ShareLink', shareLinkSchema);
