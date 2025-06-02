// const express = require('express');
// const router = express.Router();
// const Car = require('../models/Car');

// // Get all available cars
// router.get('/', async (req, res) => {
//   try {
//     const cars = await Car.find({ isAvailable: true });
//     res.json(cars);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// // Get car by ID
// router.get('/:id', async (req, res) => {
//   try {
//     const car = await Car.findOne({ carId: req.params.id });
//     if (!car) {
//       return res.status(404).json({ message: 'Car not found' });
//     }
//     res.json(car);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// // Add new car
// router.post('/', async (req, res) => {
//   try {
//     const car = new Car(req.body);
//     const savedCar = await car.save();
//     res.status(201).json(savedCar);
//   } catch (error) {
//     res.status(400).json({ message: error.message });
//   }
// });

// // Update car availability
// router.patch('/:id/availability', async (req, res) => {
//   try {
//     const car = await Car.findOneAndUpdate(
//       { carId: req.params.id },
//       { isAvailable: req.body.isAvailable },
//       { new: true }
//     );
//     res.json(car);
//   } catch (error) {
//     res.status(400).json({ message: error.message });
//   }
// });

// module.exports = router;

// routes/cars.js
const express = require('express');
const router = express.Router();
const Car = require('../models/Car');
const Rental = require('../models/Rental');

// GET /api/cars - Ambil semua data mobil
router.get('/', async (req, res) => {
  try {
    const cars = await Car.find().sort({ createdAt: -1 });
    res.json(cars);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/cars/:carId - Ambil data mobil berdasarkan ID
router.get('/:carId', async (req, res) => {
  try {
    const car = await Car.findOne({ carId: req.params.carId });
    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }
    res.json(car);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/cars - Tambah data mobil baru
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
      // Data tambahan untuk database
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

    const car = new Car({
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
      description,
      isAvailable: true
    });

    const savedCar = await car.save();
    res.status(201).json(savedCar);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PUT /api/cars/:carId - Update data mobil
router.put('/:carId', async (req, res) => {
  try {
    const car = await Car.findOneAndUpdate(
      { carId: req.params.carId },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }
    
    res.json(car);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE /api/cars/:carId - Hapus data mobil
router.delete('/:carId', async (req, res) => {
  try {
    const car = await Car.findOneAndDelete({ carId: req.params.carId });
    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }
    res.json({ message: 'Car deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/cars/:carId/book - Buat booking baru
router.post('/:carId/book', async (req, res) => {
  try {
    const {
      renter,
      startTime,
      endTime,
      totalAmount,
      transactionHash,
      blockNumber
    } = req.body;

    // Update status mobil menjadi tidak tersedia
    await Car.findOneAndUpdate(
      { carId: req.params.carId },
      { isAvailable: false }
    );

    // Buat record rental baru
    const rental = new Rental({
      carId: req.params.carId,
      renter,
      startTime: new Date(startTime * 1000),
      endTime: new Date(endTime * 1000),
      totalAmount,
      transactionHash,
      blockNumber,
      status: 'active'
    });

    const savedRental = await rental.save();
    res.status(201).json(savedRental);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PUT /api/cars/:carId/cancel - Cancel booking
router.put('/:carId/cancel', async (req, res) => {
  try {
    const { transactionHash, blockNumber } = req.body;

    // Update status mobil menjadi tersedia
    await Car.findOneAndUpdate(
      { carId: req.params.carId },
      { isAvailable: true }
    );

    // Update status rental menjadi cancelled
    const rental = await Rental.findOneAndUpdate(
      { carId: req.params.carId, status: 'active' },
      {
        status: 'cancelled',
        cancelTransactionHash: transactionHash,
        cancelBlockNumber: blockNumber,
        cancelledAt: new Date()
      },
      { new: true }
    );

    res.json(rental);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PUT /api/cars/:carId/complete - Complete rental
router.put('/:carId/complete', async (req, res) => {
  try {
    const { transactionHash, blockNumber } = req.body;

    // Update status mobil menjadi tersedia
    await Car.findOneAndUpdate(
      { carId: req.params.carId },
      { isAvailable: true }
    );

    // Update status rental menjadi completed
    const rental = await Rental.findOneAndUpdate(
      { carId: req.params.carId, status: 'active' },
      {
        status: 'completed',
        completeTransactionHash: transactionHash,
        completeBlockNumber: blockNumber,
        completedAt: new Date()
      },
      { new: true }
    );

    res.json(rental);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// GET /api/cars/:carId/rentals - Ambil riwayat rental mobil
router.get('/:carId/rentals', async (req, res) => {
  try {
    const rentals = await Rental.find({ carId: req.params.carId })
      .sort({ createdAt: -1 });
    res.json(rentals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/rentals/user/:address - Ambil rental berdasarkan user
router.get('/user/:address', async (req, res) => {
  try {
    const rentals = await Rental.find({ renter: req.params.address })
      .sort({ createdAt: -1 });
    res.json(rentals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;