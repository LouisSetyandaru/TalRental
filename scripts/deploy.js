const { ethers } = require("hardhat");

async function main() {
  console.log("Starting CarRental contract deployment...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  
  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // Get the contract factory
  const CarRental = await ethers.getContractFactory("CarRental");

  // Deploy the contract
  console.log("Deploying CarRental contract...");
  const carRental = await CarRental.deploy();

  // Wait for deployment to be mined
  await carRental.waitForDeployment();

  const contractAddress = await carRental.getAddress();
  console.log("CarRental contract deployed to:", contractAddress);

  // Verify deployment
  console.log("Verifying deployment...");
  const carCount = await carRental.carCount();
  console.log("Initial car count:", carCount.toString());

  // Save deployment info
  const deploymentInfo = {
    network: await ethers.provider.getNetwork(),
    contractAddress: contractAddress,
    deployer: deployer.address,
    blockNumber: await ethers.provider.getBlockNumber(),
    gasUsed: "Check transaction receipt",
    timestamp: new Date().toISOString()
  };

  console.log("\n=== Deployment Summary ===");
  console.log("Network:", deploymentInfo.network.name);
  console.log("Chain ID:", deploymentInfo.network.chainId);
  console.log("Contract Address:", deploymentInfo.contractAddress);
  console.log("Deployer:", deploymentInfo.deployer);
  console.log("Block Number:", deploymentInfo.blockNumber);
  console.log("Deployment Time:", deploymentInfo.timestamp);

  // Optional: Add some test data for development
  if (process.env.NODE_ENV === "development") {
    console.log("\n=== Adding Test Data ===");
    try {
      // List a test car
      const testCarTx = await carRental.listCar(
        ethers.parseEther("0.1"), // 0.1 ETH per day
        ethers.parseEther("0.5"), // 0.5 ETH deposit
        "Test Car - 2023 Tesla Model 3, Red"
      );
      await testCarTx.wait();
      console.log("Test car listed successfully!");

      const newCarCount = await carRental.carCount();
      console.log("Updated car count:", newCarCount.toString());
    } catch (error) {
      console.log("Error adding test data:", error.message);
    }
  }

  // Network-specific post-deployment actions
  const networkName = deploymentInfo.network.name;
  
  if (networkName === "mainnet") {
    console.log("\n  MAINNET DEPLOYMENT DETECTED!");
    console.log(" Remember to verify your contract on Etherscan");
    console.log(" Update your frontend with the new contract address");
    console.log(" Ensure contract ownership is properly managed");
  } else if (networkName === "goerli" || networkName === "sepolia") {
    console.log("\n Testnet deployment completed");
    console.log(" Verify on testnet explorer if needed");
    console.log(" You can add test data using the contract functions");
  }

  // Generate ABI file for frontend
  console.log("\n=== Generating ABI File ===");
  const fs = require("fs");
  const path = require("path");

  const abiDir = path.join(__dirname, "../frontend/src/contracts");
  const abiFile = path.join(abiDir, "CarRentalABI.json");

  // Ensure directory exists
  if (!fs.existsSync(abiDir)) {
    fs.mkdirSync(abiDir, { recursive: true });
  }

  // Write ABI to file
  const contractArtifact = await ethers.getContractFactory("CarRental");
  const abi = contractArtifact.interface.formatJson();
  
  fs.writeFileSync(abiFile, abi);
  console.log("ABI file generated at:", abiFile);

  // Generate deployment config file
  const configFile = path.join(abiDir, "deployment.json");
  fs.writeFileSync(configFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("Deployment config saved to:", configFile);

  console.log("\n Deployment completed successfully!");
  console.log("\n Next Steps:");
  console.log("1. Update CONTRACT_ADDRESS in your frontend");
  console.log("2. Update the ABI import in your React app");
  console.log("3. Test the contract functions");
  console.log("4. Consider verifying the contract on block explorer");

  return {
    contractAddress,
    deployer: deployer.address,
    network: deploymentInfo.network
  };
}

// Error handling and script execution
main()
  .then((result) => {
    console.log("\n Script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n Deployment failed:", error);
    process.exit(1);
  });