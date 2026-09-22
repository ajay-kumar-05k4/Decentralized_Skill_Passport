# Digital Skill Passport — Blockchain / Web3 Layer

This is the on-chain layer of the Digital Skill Passport system (see `ARTIFICIAL INTELLIGENCE LAYER`,
`APPLICATION / API LAYER`, etc. in the main system architecture diagram). It implements the
**Decentralized Identity (DID)** and **Solidity Smart Contracts** boxes, deployed via **Hardhat**.

## Contracts

### `contracts/DIDRegistry.sol`
On-chain identity registry.

- Every wallet (Learner, Institution, Employer) calls `registerIdentity(role, didDocumentURI)` to
  self-register. `didDocumentURI` is an `ipfs://<CID>` pointer to a DID document / profile JSON
  stored via **IPFS / Pinata** (the Decentralized Storage Layer in the diagram).
- Learners and Employers are auto-verified. **Institutions are not** — they stay unverified until
  the platform `admin` calls `verifyInstitution(address, true)`. This is what gives the
  Credential Verification Service its trust anchor: only vetted institutions can issue credentials.
- `getIdentity(address)`, `isVerifiedInstitution(address)`, `getInstitutions()` are the read paths
  your backend / frontend will call.

### `contracts/CredentialRegistry.sol`
Issues, verifies and revokes skill credentials. Deployed with a reference to `DIDRegistry`.

- `issueCredential(learner, skillName, metadataURI, expiresAt)` — only callable by a verified
  institution. `metadataURI` is the `ipfs://<CID>` of the certificate/metadata JSON uploaded to
  IPFS/Pinata; only the CID and a few fields live on-chain to keep gas cheap. `expiresAt = 0` means
  it never expires.
- `verifyCredential(id)` — **public, anyone can call it** (this is what powers the "Credential
  Verification" feature for Employers/Recruiters). Returns validity (`false` if revoked or expired),
  issuer, learner, skill name, metadata URI, timestamps.
- `revokeCredential(id)` — only the original issuing institution can revoke.
- `getCredentialsByLearner(address)` / `getCredentialsByIssuer(address)` — for building a learner's
  "passport" view or an institution's issuance history.

Both contracts are dependency-free (no OpenZeppelin needed) so there's nothing extra to install.

## Project layout

```
blockchain/
├── contracts/
│   ├── DIDRegistry.sol
│   ├── CredentialRegistry.sol
│   └── legacy/Lock.sol          # original Hardhat sample, kept for reference only
├── ignition/modules/
│   ├── DigitalSkillPassport.js  # deploys DIDRegistry + CredentialRegistry together
│   └── legacy/Lock.js
├── scripts/
│   └── interact.js              # end-to-end demo: register → verify → issue → verify → revoke
├── test/
│   ├── DIDRegistry.test.js      # 9 tests
│   ├── CredentialRegistry.test.js # 10 tests
│   └── legacy/Lock.js
├── hardhat.config.js
└── .env.example                 # only needed for testnet deployment
```

> All 19 tests, the compile step, the Ignition deployment, and the demo script in `scripts/interact.js`
> were run and verified passing before being added to this project.

## Running it

```bash
cd blockchain
npm install                # if you haven't already
npx hardhat compile
npx hardhat test
```

To try the full flow interactively:

```bash
# terminal 1
npx hardhat node

# terminal 2
npx hardhat run scripts/interact.js --network localhost
```

To deploy with Hardhat Ignition (recommended over raw scripts for real deployments):

```bash
npx hardhat ignition deploy ./ignition/modules/DigitalSkillPassport.js --network localhost
```

### Deploying to a public testnet (optional)

1. `npm install --save-dev dotenv`
2. `cp .env.example .env` and fill in `SEPOLIA_RPC_URL` and `PRIVATE_KEY` (use a throwaway wallet).
3. `npx hardhat ignition deploy ./ignition/modules/DigitalSkillPassport.js --network sepolia`

## Wiring this into your Node.js / Express backend

Your `Credential Management Service` and `Credential Verification Service` (Application/API Layer)
talk to these contracts with **ethers.js**. After deploying, copy the ABI + address from
`artifacts/contracts/CredentialRegistry.sol/CredentialRegistry.json` and the deployed address from
Ignition's output (`ignition/deployments/<chain-id>/deployed_addresses.json`).

```js
// backend example (Node.js + Express + ethers v6)
const { ethers } = require("ethers");
const CredentialRegistryABI = require("./abi/CredentialRegistry.json").abi;

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL); // e.g. http://127.0.0.1:8545
const credentialRegistry = new ethers.Contract(
  process.env.CREDENTIAL_REGISTRY_ADDRESS,
  CredentialRegistryABI,
  provider
);

// Verification Service - read-only, no gas, no signer needed
async function verifyCredential(id) {
  return credentialRegistry.verifyCredential(id);
}

// Credential Management Service - institution issues a credential (needs a signer,
// typically the institution's wallet via MetaMask on the frontend, or a backend
// relayer wallet if you want gasless UX for institutions)
async function issueCredential(signer, learnerAddress, skillName, ipfsMetadataURI) {
  const contractWithSigner = credentialRegistry.connect(signer);
  const tx = await contractWithSigner.issueCredential(learnerAddress, skillName, ipfsMetadataURI, 0);
  const receipt = await tx.wait();
  return receipt;
}
```

### MetaMask (frontend, React.js layer)

The learner/institution wallet connection happens client-side. Standard flow:

```js
// React.js Web Application layer
const provider = new ethers.BrowserProvider(window.ethereum);
await provider.send("eth_requestAccounts", []);
const signer = await provider.getSigner();
const credentialRegistry = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
```

### IPFS / Pinata (Decentralized Storage Layer)

Upload the certificate file + metadata JSON to Pinata first, get back a CID, then pass
`ipfs://<CID>` as `metadataURI` when calling `issueCredential`. Never store the raw certificate
file on-chain — only the CID.

## Design notes / what's intentionally out of scope here

- **Skill Gap Analysis, Employability Assessment, Talent Matching, Learning Recommendations**
  (the AI Layer in the diagram) are off-chain — they read credential data via the Verification
  Service / MongoDB, not from the smart contracts directly.
- **MongoDB Atlas** stays the source of truth for rich profile data, search indexes, and anything
  that changes often; the blockchain only stores the tamper-proof, verifiable core of a credential
  (who issued it, to whom, what skill, when, and a pointer to its metadata).
- If you later want gasless issuance (institutions shouldn't need ETH/testnet funds to issue
  credentials), look into a backend relayer pattern or meta-transactions — that's a reasonable
  next iteration, not included here to keep the contracts simple and auditable.
