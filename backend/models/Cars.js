const mongoose = require('mongoose');

const carSchema = new mongoose.Schema({
  carId: {
    type: Number,
    required: true,
    unique: true
  },
  owner: {
    type: String,
    required: true
  },
  model: {
    type: String,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  imageURL: {
    type: String,
    required: true
  },
  specs: {
    seats: Number,
    transmission: String,
    fuelType: String,
    color: String
  },
  pricePerDay: {
    type: Number,
    required: true
  },
  depositAmount: {
    type: Number,
    required: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  location: {
    city: String,
    address: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Car', carSchema);