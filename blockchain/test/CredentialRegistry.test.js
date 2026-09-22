const { expect } = require("chai");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { ethers } = require("hardhat");

const Role = { None: 0, Learner: 1, Institution: 2, Employer: 3, Admin: 4 };

describe("CredentialRegistry", function () {
  async function deployFixture() {
    const [admin, institution, learner, other] = await ethers.getSigners();

    const DIDRegistry = await ethers.getContractFactory("DIDRegistry");
    const didRegistry = await DIDRegistry.deploy();

    const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
    const credentialRegistry = await CredentialRegistry.deploy(await didRegistry.getAddress());

    await didRegistry.connect(institution).registerIdentity(Role.Institution, "ipfs://inst-did");
    await didRegistry.verifyInstitution(institution.address, true);

    return { didRegistry, credentialRegistry, admin, institution, learner, other };
  }

  it("deploys with the correct DIDRegistry address", async function () {
    const { credentialRegistry, didRegistry } = await loadFixture(deployFixture);
    expect(await credentialRegistry.didRegistry()).to.equal(await didRegistry.getAddress());
  });

  it("lets a verified institution issue a credential", async function () {
    const { credentialRegistry, institution, learner } = await loadFixture(deployFixture);

    await expect(
      credentialRegistry
        .connect(institution)
        .issueCredential(learner.address, "Blockchain Development", "ipfs://cred-1", 0)
    )
      .to.emit(credentialRegistry, "CredentialIssued")
      .withArgs(1, institution.address, learner.address, "Blockchain Development", "ipfs://cred-1");

    expect(await credentialRegistry.totalCredentials()).to.equal(1);

    const cred = await credentialRegistry.verifyCredential(1);
    expect(cred.valid).to.equal(true);
    expect(cred.issuer).to.equal(institution.address);
    expect(cred.learner).to.equal(learner.address);
    expect(cred.skillName).to.equal("Blockchain Development");
    expect(cred.metadataURI).to.equal("ipfs://cred-1");
    expect(cred.revoked).to.equal(false);
  });

  it("rejects issuance from an unverified / non-institution address", async function () {
    const { credentialRegistry, other, learner } = await loadFixture(deployFixture);
    await expect(
      credentialRegistry.connect(other).issueCredential(learner.address, "Solidity", "ipfs://x", 0)
    ).to.be.revertedWith("CredentialRegistry: caller is not a verified institution");
  });

  it("rejects issuance if the institution's verification is later revoked", async function () {
    const { credentialRegistry, didRegistry, institution, learner } = await loadFixture(deployFixture);
    await didRegistry.verifyInstitution(institution.address, false);
    await expect(
      credentialRegistry.connect(institution).issueCredential(learner.address, "Solidity", "ipfs://x", 0)
    ).to.be.revertedWith("CredentialRegistry: caller is not a verified institution");
  });

  it("tracks credentials per learner and per issuer", async function () {
    const { credentialRegistry, institution, learner } = await loadFixture(deployFixture);
    await credentialRegistry.connect(institution).issueCredential(learner.address, "Skill A", "ipfs://a", 0);
    await credentialRegistry.connect(institution).issueCredential(learner.address, "Skill B", "ipfs://b", 0);

    const learnerCreds = await credentialRegistry.getCredentialsByLearner(learner.address);
    const issuerCreds = await credentialRegistry.getCredentialsByIssuer(institution.address);
    expect(learnerCreds.map(Number)).to.deep.equal([1, 2]);
    expect(issuerCreds.map(Number)).to.deep.equal([1, 2]);
  });

  it("lets only the issuing institution revoke a credential", async function () {
    const { credentialRegistry, institution, learner, other } = await loadFixture(deployFixture);
    await credentialRegistry.connect(institution).issueCredential(learner.address, "Skill A", "ipfs://a", 0);

    await expect(credentialRegistry.connect(other).revokeCredential(1)).to.be.revertedWith(
      "CredentialRegistry: only issuer can revoke"
    );

    await expect(credentialRegistry.connect(institution).revokeCredential(1))
      .to.emit(credentialRegistry, "CredentialRevoked")
      .withArgs(1, institution.address);

    const cred = await credentialRegistry.verifyCredential(1);
    expect(cred.valid).to.equal(false);
    expect(cred.revoked).to.equal(true);
  });

  it("prevents revoking an already-revoked credential", async function () {
    const { credentialRegistry, institution, learner } = await loadFixture(deployFixture);
    await credentialRegistry.connect(institution).issueCredential(learner.address, "Skill A", "ipfs://a", 0);
    await credentialRegistry.connect(institution).revokeCredential(1);
    await expect(credentialRegistry.connect(institution).revokeCredential(1)).to.be.revertedWith(
      "CredentialRegistry: already revoked"
    );
  });

  it("reverts verifyCredential for a non-existent id", async function () {
    const { credentialRegistry } = await loadFixture(deployFixture);
    await expect(credentialRegistry.verifyCredential(999)).to.be.revertedWith(
      "CredentialRegistry: credential does not exist"
    );
  });

  it("marks a credential invalid once it expires", async function () {
    const { credentialRegistry, institution, learner } = await loadFixture(deployFixture);
    const latest = await time.latest();
    const expiresAt = latest + 60;

    await credentialRegistry.connect(institution).issueCredential(learner.address, "Skill A", "ipfs://a", expiresAt);

    let cred = await credentialRegistry.verifyCredential(1);
    expect(cred.valid).to.equal(true);

    await time.increase(120);

    cred = await credentialRegistry.verifyCredential(1);
    expect(cred.valid).to.equal(false);
    expect(cred.revoked).to.equal(false); // expired, not revoked
  });

  it("rejects an expiresAt timestamp in the past", async function () {
    const { credentialRegistry, institution, learner } = await loadFixture(deployFixture);
    const latest = await time.latest();
    await expect(
      credentialRegistry
        .connect(institution)
        .issueCredential(learner.address, "Skill A", "ipfs://a", latest - 10)
    ).to.be.revertedWith("CredentialRegistry: expiresAt in the past");
  });
});
