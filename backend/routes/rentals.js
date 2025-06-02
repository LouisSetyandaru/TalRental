const express = require('express');
const router = express.Router();
const Rental = require('../models/Rental');

// Get all rentals for a user
router.get('/user/:address', async (req, res) => {
  try {
    const rentals = await Rental.find({
      $or: [
        { renter: req.params.address },
        { owner: req.params.address }
      ]
    }).sort({ createdAt: -1 });
    res.json(rentals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new rental record
router.post('/', async (req, res) => {
  try {
    const rental = new Rental(req.body);
    const savedRental = await rental.save();
    res.status(201).json(savedRental);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update rental status
router.patch('/:id/status', async (req, res) => {
  try {
    const rental = await Rental.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    res.json(rental);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;