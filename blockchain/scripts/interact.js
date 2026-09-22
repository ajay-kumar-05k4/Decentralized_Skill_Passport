// Demo of the full Digital Skill Passport on-chain flow:
//   1. Admin deploys DIDRegistry + CredentialRegistry
//   2. An Institution self-registers a DID, Admin verifies it
//   3. A Learner self-registers a DID
//   4. The verified Institution issues a skill credential to the Learner
//      (metadataURI would normally be an ipfs://<CID> from Pinata/IPFS)
//   5. Anyone (e.g. an Employer) verifies the credential
//   6. The Institution revokes it and verification reflects that
//
// Run against a local node:
//   npx hardhat node                     (in one terminal)
//   npx hardhat run scripts/interact.js --network localhost   (in another)
const { ethers } = require("hardhat");

const Role = { Learner: 1, Institution: 2, Employer: 3 };

async function main() {
  const [admin, institution, learner, employer] = await ethers.getSigners();

  const DIDRegistry = await ethers.getContractFactory("DIDRegistry");
  const didRegistry = await DIDRegistry.deploy();
  await didRegistry.waitForDeployment();
  console.log("DIDRegistry deployed to:", await didRegistry.getAddress());

  const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
  const credentialRegistry = await CredentialRegistry.deploy(await didRegistry.getAddress());
  await credentialRegistry.waitForDeployment();
  console.log("CredentialRegistry deployed to:", await credentialRegistry.getAddress());

  // 2. Institution registers + gets verified by Admin
  await (await didRegistry.connect(institution).registerIdentity(Role.Institution, "ipfs://institution-did-doc")).wait();
  await (await didRegistry.verifyInstitution(institution.address, true)).wait();
  console.log(`Institution ${institution.address} verified:`, await didRegistry.isVerifiedInstitution(institution.address));

  // 3. Learner registers
  await (await didRegistry.connect(learner).registerIdentity(Role.Learner, "ipfs://learner-did-doc")).wait();

  // 4. Institution issues a credential (metadataURI would come from Pinata/IPFS upload)
  const tx = await credentialRegistry
    .connect(institution)
    .issueCredential(learner.address, "Full-Stack Blockchain Development", "ipfs://Qm.../credential.json", 0);
  const receipt = await tx.wait();
  const issuedEvent = receipt.logs
    .map((log) => {
      try {
        return credentialRegistry.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((e) => e && e.name === "CredentialIssued");
  const credentialId = issuedEvent.args.id;
  console.log("Issued credential #", credentialId.toString());

  // 5. Anyone can verify it (e.g. an employer)
  let result = await credentialRegistry.connect(employer).verifyCredential(credentialId);
  console.log("Verification result:", {
    valid: result.valid,
    issuer: result.issuer,
    learner: result.learner,
    skillName: result.skillName,
    metadataURI: result.metadataURI,
  });

  // 6. Institution revokes it
  await (await credentialRegistry.connect(institution).revokeCredential(credentialId)).wait();
  result = await credentialRegistry.verifyCredential(credentialId);
  console.log("After revocation, valid:", result.valid, "revoked:", result.revoked);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
