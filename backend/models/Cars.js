const mongoose = require('mongoose');

const carSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  }, // Will match with carId from smart contract
  model: {
    type: String,
    required: true
  },
  year: {
    type: Number,
    required: true,
    min: 1980,
    max: new Date().getFullYear() + 1
  },
  imageURL: {
    type: String,
    default: ''
  },
  specs: {
    seats: {
      type: Number,
      default: 4
    },
    transmission: {
      type: String,
      default: 'Automatic'
    },
    color: {
      type: String,
      default: ''
    },
    type: {
      type: String,
      default: ''
    },
    features: [{
      type: String
    }]
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
  isAvailable: {
    type: Boolean,
    default: true
  },
  ownerAddress: {
    type: String,
    required: true
  }, // Wallet address of the owner

  // Additional database-only fields
  carBrand: {
    type: String,
    default: ''
  },
  carModel: {
    type: String,
    default: ''
  },
  carYear: {
    type: String,
    default: ''
  },
  carColor: {
    type: String,
    default: ''
  },
  carType: {
    type: String,
    default: ''
  },
  carImage: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    default: ''
  },
  features: [{
    type: String
  }],
  description: {
    type: String,
    default: ''
  },
  metadataURI: {
    type: String,
    default: ''
  },

  // Blockchain transaction info
  transactionHash: {
    type: String,
    default: ''
  },
  blockNumber: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true // This will automatically add createdAt and updatedAt fields
});

// Indexes for better query performance
carSchema.index({ isAvailable: 1 });
carSchema.index({ ownerAddress: 1 });
carSchema.index({ carBrand: 1, carModel: 1 });
carSchema.index({ location: 1 });

// Virtual field for display name
carSchema.virtual('displayName').get(function () {
  if (this.carBrand && this.carModel) {
    return `${this.carBrand} ${this.carModel} ${this.carYear || ''}`.trim();
  }
  return `Car #${this._id}`;
});

// Ensure virtual fields are serialized
carSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('Car', carSchema);