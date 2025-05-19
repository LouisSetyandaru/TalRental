const hre = require("hardhat");

async function main() {
  const CarRental = await hre.ethers.getContractFactory("DecentraRent");
  const contract = await CarRental.deploy();
  await contract.deployed();
  console.log(`Contract deployed to: ${contract.address}`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});