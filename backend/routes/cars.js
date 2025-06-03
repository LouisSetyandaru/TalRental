const express = require('express');
const router = express.Router();
const Car = require('../models/Car');
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const db = db.getDb();
    const cars = await db.collection('cars').find({ isAvailable: true }).toArray();
    res.json(cars);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  const { _id, model, year, imageURL, specs, pricePerDay, depositAmount, ownerAddress } = req.body;
  
  const car = new Car({
    _id,
    model,
    year,
    imageURL,
    specs,
    pricePerDay,
    depositAmount,
    ownerAddress,
    isAvailable: true
  });

  try {
    const db = db.getDb();
    const newCar = await db.collection('cars').insertOne(car);
    res.status(201).json(newCar);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;