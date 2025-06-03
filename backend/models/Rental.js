const mongoose = require('mongoose');

const rentalSchema = new mongoose.Schema({
  carId: { type: String, required: true },
  renterAddress: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  // Tambahan field untuk sinkronisasi dengan blockchain
  txHash: { type: String }, // Transaksi hash dari blockchain
  blockNumber: { type: Number } // Block number saat transaksi terjadi
});

module.exports = mongoose.model('Rental', rentalSchema);