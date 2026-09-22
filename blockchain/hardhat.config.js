require("@nomicfoundation/hardhat-toolbox");

// Loads variables from a .env file if the `dotenv` package is installed.
// Run `npm install --save-dev dotenv` if you want to deploy to a testnet.
try {
  require("dotenv").config();
} catch (_) {
  // dotenv not installed - fine for local-only development
}

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    // Local Hardhat network (default) - no config needed, used by `npx hardhat test`
    // Local persistent node - run `npx hardhat node` then deploy with --network localhost
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // Optional public testnet deployment. Only active if SEPOLIA_RPC_URL / PRIVATE_KEY
    // are set in a .env file (see .env.example). Safe to leave unset for local dev.
    ...(SEPOLIA_RPC_URL && PRIVATE_KEY
      ? {
          sepolia: {
            url: SEPOLIA_RPC_URL,
            accounts: [PRIVATE_KEY],
          },
        }
      : {}),
  },
};
