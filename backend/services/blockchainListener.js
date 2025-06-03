const { ethers } = require('ethers');
const db = require('../db');
const Car = require('../models/Car');
const Rental = require('../models/Rental');

// Inisialisasi provider (sesuaikan dengan network yang digunakan)
const provider = new ethers.providers.JsonRpcProvider(
  process.env.BLOCKCHAIN_PROVIDER || 'http://localhost:8545'
);

// ABI smart contract (ambil dari file compiled contract Anda)
const contractABI = require('../../contracts/CarRental.sol').abi;

// Alamat smart contract (isi dengan alamat kontrak yang sudah di-deploy)
const contractAddress = process.env.CONTRACT_ADDRESS;

// Fungsi utama untuk memulai listener
async function startBlockchainListener() {
  try {
    // Pastikan koneksi database sudah tersedia
    await db.connectToServer();
    
    const carRentalContract = new ethers.Contract(
      contractAddress,
      contractABI,
      provider
    );

    console.log('Blockchain listener started...');

    // Listen untuk event CarListed
    carRentalContract.on('CarListed', async (carId, owner, pricePerDay, depositAmount, metadataURI) => {
      console.log(`New car listed: ID ${carId} by ${owner}`);
      
      try {
        const dbInstance = db.getDb();
        
        await dbInstance.collection('cars').insertOne({
          _id: carId.toString(),
          ownerAddress: owner,
          pricePerDay: ethers.utils.formatUnits(pricePerDay, 'ether'),
          depositAmount: ethers.utils.formatUnits(depositAmount, 'ether'),
          isAvailable: true,
          metadataURI: metadataURI,
          createdAt: new Date()
        });
        
        console.log(`Car ${carId} data saved to MongoDB`);
      } catch (err) {
        console.error('Error saving car to MongoDB:', err);
      }
    });

    // Listen untuk event CarBooked
    carRentalContract.on('CarBooked', async (carId, renter, startTime, endTime, paidAmount) => {
      console.log(`Car booked: ID ${carId} by ${renter}`);
      
      try {
        const dbInstance = db.getDb();
        
        await dbInstance.collection('rentals').insertOne({
          carId: carId.toString(),
          renterAddress: renter,
          startTime: new Date(startTime * 1000), // Convert Unix timestamp to JS Date
          endTime: new Date(endTime * 1000),
          isActive: true,
          paidAmount: ethers.utils.formatUnits(paidAmount, 'ether'),
          createdAt: new Date()
        });
        
        // Update status mobil menjadi tidak tersedia
        await dbInstance.collection('cars').updateOne(
          { _id: carId.toString() },
          { $set: { isAvailable: false } }
        );
        
        console.log(`Booking for car ${carId} saved to MongoDB`);
      } catch (err) {
        console.error('Error saving booking to MongoDB:', err);
      }
    });

    // Tambahkan listener untuk event lainnya (BookingCancelled, RentalCompleted) dengan pola yang sama

  } catch (err) {
    console.error('Failed to start blockchain listener:', err);
    process.exit(1);
  }
}

module.exports = startBlockchainListener;
