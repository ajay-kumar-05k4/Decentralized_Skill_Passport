const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

// Deploys the Digital Skill Passport blockchain layer:
//   1. DIDRegistry           - identity + institution verification
//   2. CredentialRegistry    - issues/verifies/revokes skill credentials, wired to DIDRegistry
//
// Usage:
//   npx hardhat ignition deploy ./ignition/modules/DigitalSkillPassport.js --network localhost
module.exports = buildModule("DigitalSkillPassportModule", (m) => {
  const didRegistry = m.contract("DIDRegistry");
  const credentialRegistry = m.contract("CredentialRegistry", [didRegistry]);

  return { didRegistry, credentialRegistry };
});
