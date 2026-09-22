const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLE_NAMES } = require('./Role');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    role: { type: String, enum: ROLE_NAMES, default: 'learner' },
    organization: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    // Decentralized Identity (DID) anchor.
    // identityHash = SHA-256(uniqueIdNumber : secretPhrase). The raw values
    // are never stored - see utils/hash.js. This is the digest a third-party
    // verifier checks, and the value that will be written on-chain once the
    // Blockchain/Web3 layer is integrated.
    identityHash: { type: String, default: null, index: true },
    identitySetAt: { type: Date, default: null },
    // Placeholder for future Blockchain/Web3 layer (MetaMask wallet binding)
    walletAddress: { type: String, default: null },
    lastLogin: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function matchPassword(enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
