const express = require('express');
const router = express.Router();
const Car = require('../models/Cars');

// GET all available cars
router.get('/', async (req, res) => {
  try {
    const cars = await Car.find({ isAvailable: true });
    res.json(cars);
  } catch (err) {
    console.error('Error fetching cars:', err);
    res.status(500).json({ message: err.message });
  }
});

// GET single car by ID
router.get('/:id', async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }
    res.json(car);
  } catch (err) {
    console.error('Error fetching car:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST create new car
router.post('/', async (req, res) => {
  try {
    const {
      carId,
      owner,
      pricePerDay,
      depositAmount,
      metadataURI,
      transactionHash,
      blockNumber,
      carBrand,
      carModel,
      carYear,
      carColor,
      carType,
      carImage,
      location,
      features,
      description
    } = req.body;

    // Validation
    if (!carId || !owner || !pricePerDay || !depositAmount) {
      return res.status(400).json({
        message: 'Missing required fields: carId, owner, pricePerDay, depositAmount'
      });
    }

    const carData = {
      _id: carId, // Use carId as the MongoDB _id
      model: carBrand && carModel ? `${carBrand} ${carModel}` : `Car #${carId}`,
      year: carYear ? parseInt(carYear) : new Date().getFullYear(),
      imageURL: carImage || '',
      specs: {
        seats: 4, // default value
        transmission: 'Automatic', // default value
        color: carColor || '',
        type: carType || '',
        features: features || []
      },
      pricePerDay: parseFloat(pricePerDay),
      depositAmount: parseFloat(depositAmount),
      isAvailable: true,
      ownerAddress: owner,
      // Additional fields for database
      carBrand: carBrand || '',
      carModel: carModel || '',
      carYear: carYear || '',
      carColor: carColor || '',
      carType: carType || '',
      carImage: carImage || '',
      location: location || '',
      features: features || [],
      description: description || metadataURI || '',
      metadataURI: metadataURI || '',
      transactionHash: transactionHash || '',
      blockNumber: blockNumber || 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const car = new Car(carData);
    const savedCar = await car.save();

    console.log('Car saved successfully:', savedCar._id);
    res.status(201).json(savedCar);
  } catch (err) {
    console.error('Error creating car:', err);

    // Handle duplicate key error
    if (err.code === 11000) {
      return res.status(409).json({
        message: 'Car with this ID already exists',
        carId: req.body.carId
      });
    }

    res.status(400).json({
      message: 'Error creating car',
      error: err.message
    });
  }
});

// PUT update car availability
router.put('/:id/availability', async (req, res) => {
  try {
    const { isAvailable } = req.body;

    const car = await Car.findByIdAndUpdate(
      req.params.id,
      {
        isAvailable: isAvailable,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }

    res.json(car);
  } catch (err) {
    console.error('Error updating car availability:', err);
    res.status(400).json({ message: err.message });
  }
});

// DELETE car (soft delete - mark as unavailable)
router.delete('/:id', async (req, res) => {
  try {
    const car = await Car.findByIdAndUpdate(
      req.params.id,
      {
        isAvailable: false,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }

    res.json({ message: 'Car marked as unavailable', car });
  } catch (err) {
    console.error('Error deleting car:', err);
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;