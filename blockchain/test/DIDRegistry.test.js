const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { ethers } = require("hardhat");

const Role = { None: 0, Learner: 1, Institution: 2, Employer: 3, Admin: 4 };

describe("DIDRegistry", function () {
  async function deployFixture() {
    const [admin, institution, learner, employer, other] = await ethers.getSigners();
    const DIDRegistry = await ethers.getContractFactory("DIDRegistry");
    const registry = await DIDRegistry.deploy();
    return { registry, admin, institution, learner, employer, other };
  }

  it("sets deployer as Admin", async function () {
    const { registry, admin } = await loadFixture(deployFixture);
    expect(await registry.admin()).to.equal(admin.address);
    const id = await registry.getIdentity(admin.address);
    expect(id.role).to.equal(Role.Admin);
    expect(id.isVerified).to.equal(true);
  });

  it("allows a learner to self-register and is auto-verified", async function () {
    const { registry, learner } = await loadFixture(deployFixture);
    await expect(registry.connect(learner).registerIdentity(Role.Learner, "ipfs://learner-did"))
      .to.emit(registry, "IdentityRegistered")
      .withArgs(learner.address, Role.Learner, "ipfs://learner-did");

    const id = await registry.getIdentity(learner.address);
    expect(id.role).to.equal(Role.Learner);
    expect(id.isVerified).to.equal(true);
  });

  it("registers an institution as unverified until admin approves", async function () {
    const { registry, institution } = await loadFixture(deployFixture);
    await registry.connect(institution).registerIdentity(Role.Institution, "ipfs://inst-did");

    let id = await registry.getIdentity(institution.address);
    expect(id.isVerified).to.equal(false);
    expect(await registry.isVerifiedInstitution(institution.address)).to.equal(false);

    await expect(registry.verifyInstitution(institution.address, true))
      .to.emit(registry, "InstitutionVerified")
      .withArgs(institution.address, true);

    expect(await registry.isVerifiedInstitution(institution.address)).to.equal(true);
    id = await registry.getIdentity(institution.address);
    expect(id.isVerified).to.equal(true);
  });

  it("rejects institution verification from non-admin", async function () {
    const { registry, institution, other } = await loadFixture(deployFixture);
    await registry.connect(institution).registerIdentity(Role.Institution, "ipfs://inst-did");
    await expect(
      registry.connect(other).verifyInstitution(institution.address, true)
    ).to.be.revertedWith("DIDRegistry: caller is not admin");
  });

  it("prevents double registration", async function () {
    const { registry, learner } = await loadFixture(deployFixture);
    await registry.connect(learner).registerIdentity(Role.Learner, "ipfs://a");
    await expect(
      registry.connect(learner).registerIdentity(Role.Learner, "ipfs://b")
    ).to.be.revertedWith("DIDRegistry: identity already registered");
  });

  it("rejects self-registration with the Admin or None role", async function () {
    const { registry, other } = await loadFixture(deployFixture);
    await expect(
      registry.connect(other).registerIdentity(Role.Admin, "ipfs://x")
    ).to.be.revertedWith("DIDRegistry: invalid self-registration role");
  });

  it("lets a registered identity update its DID document", async function () {
    const { registry, learner } = await loadFixture(deployFixture);
    await registry.connect(learner).registerIdentity(Role.Learner, "ipfs://old");
    await expect(registry.connect(learner).updateDIDDocument("ipfs://new"))
      .to.emit(registry, "IdentityUpdated")
      .withArgs(learner.address, "ipfs://new");
    const id = await registry.getIdentity(learner.address);
    expect(id.didDocumentURI).to.equal("ipfs://new");
  });

  it("tracks the list of institutions", async function () {
    const { registry, institution, other } = await loadFixture(deployFixture);
    await registry.connect(institution).registerIdentity(Role.Institution, "ipfs://a");
    await registry.connect(other).registerIdentity(Role.Institution, "ipfs://b");
    const institutions = await registry.getInstitutions();
    expect(institutions).to.deep.equal([institution.address, other.address]);
  });

  it("allows admin transfer", async function () {
    const { registry, admin, other } = await loadFixture(deployFixture);
    await expect(registry.transferAdmin(other.address))
      .to.emit(registry, "AdminTransferred")
      .withArgs(admin.address, other.address);
    expect(await registry.admin()).to.equal(other.address);
  });
});
