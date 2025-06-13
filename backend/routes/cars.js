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

router.get('/rented', async (req, res) => {
  try {
    const cars = await Car.find({ isAvailable: false });
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
      carImage: carImage?.startsWith("http") ? carImage : '',
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

// Add this new route to get rented cars
router.get('/rented', async (req, res) => {
  try {
    const cars = await Car.find({ isAvailable: false });
    res.json(cars);
  } catch (err) {
    console.error('Error fetching rented cars:', err);
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const carId = req.params.id;
    const { requesterAddress } = req.body;

    const car = await Car.findById(carId);

    if (!car) return res.status(404).json({ message: 'Car not found' });

    // Ownership check
    if (car.ownerAddress.toLowerCase() !== requesterAddress.toLowerCase()) {
      return res.status(403).json({ message: 'Unauthorized: Not the car owner' });
    }

    car.isAvailable = true;
    car.updatedAt = new Date();
    await car.save();

    res.json({ message: 'Rental cancelled by owner', car });
  } catch (err) {
    console.error('Error cancelling rental:', err);
    res.status(500).json({ message: 'Failed to cancel rental' });
  }
});

router.post('/:id/complete', async (req, res) => {
  try {
    const { requesterAddress } = req.body;
    const carId = req.params.id;

    const car = await Car.findById(carId);
    if (!car) return res.status(404).json({ message: 'Car not found' });

    // Check ownership
    if (car.ownerAddress.toLowerCase() !== requesterAddress.toLowerCase()) {
      return res.status(403).json({ message: 'Unauthorized: Not the car owner' });
    }

    // Fetch latest rental that is active
    const Rental = require('../models/Rental');
    const rental = await Rental.findOne({
      carId: car._id,
      isActive: true,
      status: 'active'
    }).sort({ endTime: -1 });

    if (!rental) {
      return res.status(400).json({ message: 'No active rental found for this car' });
    }

    const now = new Date();
    if (now < rental.endTime) {
      return res.status(400).json({
        message: 'Rental period has not ended yet. Cannot complete rental.'
      });
    }

    // Mark rental as completed
    rental.status = 'completed';
    rental.isActive = false;
    rental.returnedAt = now;
    await rental.save();

    // Update car availability
    car.isAvailable = true;
    car.updatedAt = now;
    await car.save();

    res.json({
      success: true,
      message: 'Rental completed successfully',
      car,
      rental
    });
  } catch (err) {
    console.error('Error completing rental:', err);
    res.status(500).json({ message: 'Failed to complete rental', error: err.message });
  }
});

// Add this new route to handle booking
router.post('/:id/book', async (req, res) => {
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

    res.json(car);
  } catch (err) {
    console.error('Error booking car:', err);
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id/full-delete', async (req, res) => {
  try {
    const { requesterAddress, privateKey } = req.body;
    const carId = req.params.id;

    console.log(`[DELETE] Request received for carId: ${carId}`);
    console.log(`Requester: ${requesterAddress}`);

    const car = await Car.findById(carId);
    if (!car) {
      console.warn(`[DELETE] Car not found: ${carId}`);
      return res.status(404).json({ message: 'Car not found' });
    }

    if (car.ownerAddress.toLowerCase() !== requesterAddress.toLowerCase()) {
      console.warn(`[DELETE] Unauthorized: Not the car owner`);
      return res.status(403).json({ message: 'Unauthorized: Not the car owner' });
    }

    console.log(`[DELETE] Owner verified. Proceeding to smart contract deletion...`);

    console.log(`[DELETE] Deleting from DB...`);
    await Car.findByIdAndDelete(carId);

    console.log(`[DELETE] Car deleted successfully`);
    return res.json({ success: true, message: 'Deleted from blockchain and database' });

  } catch (err) {
    console.error(`[DELETE] Failed to delete car:`, err);
    return res.status(500).json({
      message: 'Failed to delete car',
      error: err.message
    });
  }
});

module.exports = router;
