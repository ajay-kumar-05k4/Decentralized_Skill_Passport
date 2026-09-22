const mongoose = require('mongoose');

const verificationRequestSchema = new mongoose.Schema(
  {
    credential: { type: mongoose.Schema.Types.ObjectId, ref: 'Credential', required: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    verifier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: {
      type: String,
      enum: ['pending', 'in_review', 'approved', 'rejected'],
      default: 'pending',
    },
    comments: { type: String, default: '' },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('VerificationRequest', verificationRequestSchema);
