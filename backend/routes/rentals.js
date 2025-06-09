const express = require('express');
const router = express.Router();
const Rental = require('../models/Rental');
const Car = require('../models/Cars');

// GET all rentals
router.get('/', async (req, res) => {
  try {
    const { renterAddress, ownerAddress, status } = req.query;

    let filter = {};
    if (renterAddress) filter.renterAddress = renterAddress;
    if (ownerAddress) filter.ownerAddress = ownerAddress;
    if (status) filter.status = status;

    const rentals = await Rental.find(filter)
      .populate('carId')
      .sort({ createdAt: -1 });

    res.json(rentals);
  } catch (err) {
    console.error('Error fetching rentals:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST create new rental (booking)
router.post('/', async (req, res) => {
  try {
    const {
      carId,
      renterAddress,
      ownerAddress,
      startTime,
      endTime,
      pickupTime,
      rentalDays,
      pricePerDay,
      depositAmount,
      totalAmount,
      specialRequests,
      bookingTransactionHash,
      blockNumber
    } = req.body;

    // Validation
    if (!carId || !renterAddress || !startTime || !endTime) {
      return res.status(400).json({
        message: 'Missing required fields: carId, renterAddress, startTime, endTime'
      });
    }

    // Check if car exists and is available
    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }

    if (!car.isAvailable) {
      return res.status(400).json({ message: 'Car is not available for booking' });
    }

    const rentalData = {
      carId,
      renterAddress,
      ownerAddress: ownerAddress || car.ownerAddress,
      startTime: new Date(startTime * 1000), // Convert from timestamp
      endTime: new Date(endTime * 1000), // Convert from timestamp
      pickupTime: pickupTime || '12:00',
      rentalDays: rentalDays || Math.ceil((endTime - startTime) / 86400),
      pricePerDay: pricePerDay || car.pricePerDay,
      depositAmount: depositAmount || car.depositAmount,
      totalAmount: totalAmount || 0,
      specialRequests: specialRequests || '',
      bookingTransactionHash: bookingTransactionHash || '',
      blockNumber: blockNumber || 0,
      status: 'active',
      isActive: true
    };

    const rental = new Rental(rentalData);
    const savedRental = await rental.save();

    // Update car availability
    await Car.findByIdAndUpdate(carId, {
      isAvailable: false,
      updatedAt: new Date()
    });

    console.log('Rental created successfully:', savedRental._id);
    res.status(201).json(savedRental);
  } catch (err) {
    console.error('Error creating rental:', err);
    res.status(400).json({
      message: 'Error creating rental',
      error: err.message
    });
  }
});

// PUT update rental (completion or cancellation)
router.put('/:id', async (req, res) => {
  try {
    const {
      status,
      returnCondition,
      returnNotes,
      fuelLevel,
      completionTransactionHash,
      cancellationTransactionHash
    } = req.body;

    const updateData = {
      updatedAt: new Date()
    };

    if (status) {
      updateData.status = status;
      updateData.isActive = status === 'active';
    }

    if (status === 'completed') {
      updateData.returnedAt = new Date();
      updateData.returnCondition = returnCondition || 'excellent';
      updateData.returnNotes = returnNotes || '';
      updateData.fuelLevel = fuelLevel || 'full';
      updateData.completionTransactionHash = completionTransactionHash || '';
    }

    if (status === 'cancelled') {
      updateData.cancellationTransactionHash = cancellationTransactionHash || '';
    }

    const rental = await Rental.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!rental) {
      return res.status(404).json({ message: 'Rental not found' });
    }

    // Update car availability if rental is completed or cancelled
    if (status === 'completed' || status === 'cancelled') {
      await Car.findByIdAndUpdate(rental.carId, {
        isAvailable: true,
        updatedAt: new Date()
      });
    }

    res.json(rental);
  } catch (err) {
    console.error('Error updating rental:', err);
    res.status(400).json({ message: err.message });
  }
});

// GET rental by ID
router.get('/:id', async (req, res) => {
  try {
    const rental = await Rental.findById(req.params.id).populate('carId');

    if (!rental) {
      return res.status(404).json({ message: 'Rental not found' });
    }

    res.json(rental);
  } catch (err) {
    console.error('Error fetching rental:', err);
    res.status(500).json({ message: err.message });
  }
});

// GET rentals by car ID
router.get('/car/:carId', async (req, res) => {
  try {
    const rentals = await Rental.find({ carId: req.params.carId })
      .sort({ createdAt: -1 });

    res.json(rentals);
  } catch (err) {
    console.error('Error fetching car rentals:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;