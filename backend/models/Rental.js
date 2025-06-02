const mongoose = require('mongoose');

const rentalSchema = new mongoose.Schema({
  carId: {
    type: Number,
    required: true
  },
  renter: {
    type: String,
    required: true
  },
  owner: {
    type: String,
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  totalCost: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['booked', 'active', 'completed', 'cancelled'],
    default: 'booked'
  },
  transactionHash: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Rental', rentalSchema);