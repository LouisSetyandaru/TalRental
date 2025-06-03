const mongoose = require('mongoose');

const carSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Akan match dengan carId di smart contract
  model: { type: String, required: true },
  year: { type: Number, required: true },
  imageURL: { type: String, required: true },
  specs: {
    seats: { type: Number },
    transmission: { type: String },
    // tambahkan spesifikasi lain sesuai kebutuhan
  },
  pricePerDay: { type: Number },
  depositAmount: { type: Number },
  isAvailable: { type: Boolean, default: true },
  ownerAddress: { type: String, required: true } // Alamat wallet pemilik
});

module.exports = mongoose.model('Car', carSchema);