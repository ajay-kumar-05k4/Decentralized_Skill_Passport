const mongoose = require('mongoose');

const credentialSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: [true, 'Credential title is required'], trim: true },
    issuer: { type: String, required: [true, 'Issuer is required'], trim: true },
    credentialType: {
      type: String,
      enum: ['certificate', 'degree', 'badge', 'course', 'license', 'other'],
      default: 'certificate',
    },
    issueDate: { type: Date, required: true },
    expiryDate: { type: Date, default: null },
    fileUrl: { type: String, default: null },
    status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    // SHA-256 of the uploaded document (or of the canonical metadata when no
    // file was attached). This is the value a third-party verifier submits,
    // and what gets anchored on-chain once the Blockchain layer lands.
    credentialHash: { type: String, default: null, index: true },
    ipfsHash: { type: String, default: null },
    txHash: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Credential', credentialSchema);
