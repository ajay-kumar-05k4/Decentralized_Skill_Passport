// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title DIDRegistry
/// @notice On-chain identity registry for the Digital Skill Passport platform.
///         Every wallet address (Learner, Institution, Employer) registers a
///         lightweight decentralized identity that points to an off-chain DID
///         document (stored on IPFS / Pinata). Institutions must additionally
///         be verified by the platform Admin before they may issue credentials.
contract DIDRegistry {
    enum Role {
        None,
        Learner,
        Institution,
        Employer,
        Admin
    }

    struct Identity {
        Role role;
        string didDocumentURI; // e.g. ipfs://<CID> pointing to the DID document / profile metadata
        bool isVerified; // true once an Admin has verified an Institution (auto-true for Learner/Employer)
        uint256 registeredAt;
    }

    address public admin;

    mapping(address => Identity) private identities;
    address[] private institutionList;

    event IdentityRegistered(address indexed account, Role role, string didDocumentURI);
    event IdentityUpdated(address indexed account, string didDocumentURI);
    event InstitutionVerified(address indexed institution, bool verified);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);

    modifier onlyAdmin() {
        require(msg.sender == admin, "DIDRegistry: caller is not admin");
        _;
    }

    constructor() {
        admin = msg.sender;
        identities[msg.sender] = Identity({
            role: Role.Admin,
            didDocumentURI: "",
            isVerified: true,
            registeredAt: block.timestamp
        });
        emit IdentityRegistered(msg.sender, Role.Admin, "");
    }

    /// @notice Self-registration for Learners, Institutions and Employers.
    /// @dev Institutions start unverified and must be approved via verifyInstitution().
    function registerIdentity(Role role, string calldata didDocumentURI) external {
        require(
            role == Role.Learner || role == Role.Institution || role == Role.Employer,
            "DIDRegistry: invalid self-registration role"
        );
        require(identities[msg.sender].role == Role.None, "DIDRegistry: identity already registered");

        identities[msg.sender] = Identity({
            role: role,
            didDocumentURI: didDocumentURI,
            isVerified: role != Role.Institution,
            registeredAt: block.timestamp
        });

        if (role == Role.Institution) {
            institutionList.push(msg.sender);
        }

        emit IdentityRegistered(msg.sender, role, didDocumentURI);
    }

    /// @notice Update the DID document pointer for the caller's own identity.
    function updateDIDDocument(string calldata didDocumentURI) external {
        require(identities[msg.sender].role != Role.None, "DIDRegistry: identity not registered");
        identities[msg.sender].didDocumentURI = didDocumentURI;
        emit IdentityUpdated(msg.sender, didDocumentURI);
    }

    /// @notice Admin approves (or revokes approval of) an institution as a trusted credential issuer.
    function verifyInstitution(address institution, bool verified) external onlyAdmin {
        require(identities[institution].role == Role.Institution, "DIDRegistry: not an institution");
        identities[institution].isVerified = verified;
        emit InstitutionVerified(institution, verified);
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "DIDRegistry: zero address");
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    function getIdentity(address account)
        external
        view
        returns (Role role, string memory didDocumentURI, bool isVerified, uint256 registeredAt)
    {
        Identity memory id = identities[account];
        return (id.role, id.didDocumentURI, id.isVerified, id.registeredAt);
    }

    function isVerifiedInstitution(address account) external view returns (bool) {
        Identity memory id = identities[account];
        return id.role == Role.Institution && id.isVerified;
    }

    function getInstitutions() external view returns (address[] memory) {
        return institutionList;
    }
}
