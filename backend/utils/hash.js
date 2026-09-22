const crypto = require('crypto');
const fs = require('fs');

// SHA-256 is the hashing algorithm used throughout the credential
// verification flow (same choice as the reference literature). Every hash
// produced here is a 64-character lowercase hex string.
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

// Identity hash = H(uniqueIdNumber : secretPhrase)
// The raw identity number and secret phrase are NEVER persisted - only this
// digest is stored, so a database leak does not expose either value.
const buildIdentityHash = (uniqueIdNumber, secretPhrase) =>
  sha256(`${String(uniqueIdNumber).trim()}:${String(secretPhrase)}`);

// Credential hash = H(file bytes) when a document was uploaded, otherwise
// H(canonical metadata). This is the value that will later be anchored
// on-chain / pinned to IPFS, so it must be reproducible from the artefact.
const hashFile = async (absolutePath) => {
  const buffer = await fs.promises.readFile(absolutePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

const hashCredentialMetadata = ({ title, issuer, credentialType, issueDate, user }) =>
  sha256(
    [
      String(title).trim().toLowerCase(),
      String(issuer).trim().toLowerCase(),
      String(credentialType || 'certificate'),
      new Date(issueDate).toISOString().slice(0, 10),
      String(user),
    ].join('|')
  );

const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString('hex');

// Constant-time compare so the public verification endpoints don't leak
// information through response timing.
const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

const isSha256Hex = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);

module.exports = {
  sha256,
  buildIdentityHash,
  hashFile,
  hashCredentialMetadata,
  randomToken,
  safeEqual,
  isSha256Hex,
};
