// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const POLYGON_MUMBAI_URL = process.env.POLYGON_MUMBAI_URL || "https://rpc-mumbai.maticvigil.com";
const POLYGON_MAINNET_URL = process.env.POLYGON_MAINNET_URL || "https://polygon-rpc.com";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.17",
  networks: {
    hardhat: {
      chainId: 1337 // Local network
    },
    mumbai: {
      url: POLYGON_MUMBAI_URL,
      accounts: [PRIVATE_KEY]
    },
    polygon: {
      url: POLYGON_MAINNET_URL,
      accounts: [PRIVATE_KEY]
    }
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
};