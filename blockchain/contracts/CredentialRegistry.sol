// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./DIDRegistry.sol";

/// @title CredentialRegistry
/// @notice Issues, verifies and revokes on-chain skill credentials ("Digital Skill Passport" entries).
///         Only institutions verified in the DIDRegistry may issue credentials. The heavy certificate
///         file (PDF/image/JSON metadata) lives on IPFS/Pinata; only its CID and a small amount of
///         structured data is stored on-chain for cheap, tamper-proof verification.
contract CredentialRegistry {
    struct Credential {
        uint256 id;
        address issuer; // verified institution wallet
        address learner; // learner's wallet address
        string skillName;
        string metadataURI; // e.g. ipfs://<CID> - certificate / metadata stored via IPFS/Pinata
        uint256 issuedAt;
        uint256 expiresAt; // 0 = never expires
        bool revoked;
    }

    DIDRegistry public immutable didRegistry;

    uint256 private nextCredentialId = 1;
    mapping(uint256 => Credential) private credentials;
    mapping(address => uint256[]) private learnerCredentials;
    mapping(address => uint256[]) private issuerCredentials;

    event CredentialIssued(
        uint256 indexed id,
        address indexed issuer,
        address indexed learner,
        string skillName,
        string metadataURI
    );
    event CredentialRevoked(uint256 indexed id, address indexed issuer);

    modifier onlyVerifiedInstitution() {
        require(didRegistry.isVerifiedInstitution(msg.sender), "CredentialRegistry: caller is not a verified institution");
        _;
    }

    constructor(address didRegistryAddress) {
        require(didRegistryAddress != address(0), "CredentialRegistry: zero address");
        didRegistry = DIDRegistry(didRegistryAddress);
    }

    /// @notice Issue a new skill credential to a learner. Only verified institutions may call this.
    function issueCredential(
        address learner,
        string calldata skillName,
        string calldata metadataURI,
        uint256 expiresAt
    ) external onlyVerifiedInstitution returns (uint256) {
        require(learner != address(0), "CredentialRegistry: invalid learner");
        require(bytes(skillName).length > 0, "CredentialRegistry: skillName required");
        require(bytes(metadataURI).length > 0, "CredentialRegistry: metadataURI required");
        if (expiresAt != 0) {
            require(expiresAt > block.timestamp, "CredentialRegistry: expiresAt in the past");
        }

        uint256 id = nextCredentialId++;
        credentials[id] = Credential({
            id: id,
            issuer: msg.sender,
            learner: learner,
            skillName: skillName,
            metadataURI: metadataURI,
            issuedAt: block.timestamp,
            expiresAt: expiresAt,
            revoked: false
        });

        learnerCredentials[learner].push(id);
        issuerCredentials[msg.sender].push(id);

        emit CredentialIssued(id, msg.sender, learner, skillName, metadataURI);
        return id;
    }

    /// @notice Revoke a credential. Only the original issuing institution may revoke.
    function revokeCredential(uint256 id) external {
        Credential storage cred = credentials[id];
        require(cred.id != 0, "CredentialRegistry: credential does not exist");
        require(cred.issuer == msg.sender, "CredentialRegistry: only issuer can revoke");
        require(!cred.revoked, "CredentialRegistry: already revoked");

        cred.revoked = true;
        emit CredentialRevoked(id, msg.sender);
    }

    /// @notice Public verification entry point - anyone (employer, recruiter) can check a credential.
    function verifyCredential(uint256 id)
        external
        view
        returns (
            bool valid,
            address issuer,
            address learner,
            string memory skillName,
            string memory metadataURI,
            uint256 issuedAt,
            uint256 expiresAt,
            bool revoked
        )
    {
        Credential memory cred = credentials[id];
        require(cred.id != 0, "CredentialRegistry: credential does not exist");

        bool notExpired = cred.expiresAt == 0 || cred.expiresAt > block.timestamp;
        valid = !cred.revoked && notExpired;

        return (valid, cred.issuer, cred.learner, cred.skillName, cred.metadataURI, cred.issuedAt, cred.expiresAt, cred.revoked);
    }

    function getCredentialsByLearner(address learner) external view returns (uint256[] memory) {
        return learnerCredentials[learner];
    }

    function getCredentialsByIssuer(address issuer) external view returns (uint256[] memory) {
        return issuerCredentials[issuer];
    }

    function totalCredentials() external view returns (uint256) {
        return nextCredentialId - 1;
    }
}
