const mongoose = require('mongoose');

const rentalSchema = new mongoose.Schema({
  carId: {
    type: String,
    required: true,
    ref: 'Car'
  },
  renterAddress: {
    type: String,
    required: true
  },
  ownerAddress: {
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
  pickupTime: {
    type: String,
    default: '12:00'
  },
  rentalDays: {
    type: Number,
    required: true,
    min: 1
  },
  pricePerDay: {
    type: Number,
    required: true,
    min: 0
  },
  depositAmount: {
    type: Number,
    required: true,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  isActive: {
    type: Boolean,
    default: true
  },

  // Booking details
  specialRequests: {
    type: String,
    default: ''
  },

  // Return details
  returnCondition: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'poor'],
    default: 'excellent'
  },
  returnNotes: {
    type: String,
    default: ''
  },
  fuelLevel: {
    type: String,
    enum: ['full', '3/4', '1/2', '1/4', 'empty'],
    default: 'full'
  },
  returnedAt: {
    type: Date
  },

  // Blockchain transaction info
  bookingTransactionHash: {
    type: String,
    default: ''
  },
  completionTransactionHash: {
    type: String,
    default: ''
  },
  cancellationTransactionHash: {
    type: String,
    default: ''
  },
  blockNumber: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for better query performance
rentalSchema.index({ carId: 1 });
rentalSchema.index({ renterAddress: 1 });
rentalSchema.index({ ownerAddress: 1 });
rentalSchema.index({ status: 1 });
rentalSchema.index({ startTime: 1, endTime: 1 });

// Virtual field for rental duration
rentalSchema.virtual('durationInDays').get(function () {
  if (this.startTime && this.endTime) {
    const diffTime = Math.abs(this.endTime - this.startTime);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  return 0;
});

// Virtual field for total cost calculation
rentalSchema.virtual('calculatedTotal').get(function () {
  return (this.pricePerDay * this.rentalDays) + this.depositAmount;
});

// Ensure virtual fields are serialized
rentalSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('Rental', rentalSchema);