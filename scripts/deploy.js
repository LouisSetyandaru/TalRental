// scripts/deploy.js
const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying CarRental contract...");

  // Get the contract factory
  const CarRental = await ethers.getContractFactory("CarRental");

  // Deploy the contract
  const carRental = await CarRental.deploy();
  
  // Wait for deployment to finish
  await carRental.deployed();

  console.log("CarRental deployed to:", carRental.address);

  // Save the contract address to be used by frontend
  saveContractData(carRental);
}

function saveContractData(contract) {
  const fs = require("fs");
  const contractsDir = __dirname + "/../frontend/src/contracts";

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  fs.writeFileSync(
    contractsDir + "/contract-address.json",
    JSON.stringify({ CarRental: contract.address }, undefined, 2)
  );

  const CarRentalArtifact = artifacts.readArtifactSync("CarRental");
  
  fs.writeFileSync(
    contractsDir + "/CarRental.json",
    JSON.stringify(CarRentalArtifact, null, 2)
  );
}

// Run the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });