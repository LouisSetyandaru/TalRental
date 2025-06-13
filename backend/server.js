// server.js - Updated backend server
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const Car = require('./models/Cars');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5050;

const path = require('path');
app.use('/metadata', express.static(path.join(__dirname, 'metadata')));

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('Request body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Routes
const carRoutes = require('./routes/cars');
const rentalRoutes = require('./routes/rentals');

app.use('/api/cars', carRoutes);
app.use('/api/rentals', rentalRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({
    message: 'Car Rental API Server is running!',
    version: '1.0.0',
    endpoints: {
      cars: '/api/cars',
      rentals: '/api/rentals',
      health: '/health'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Test database connection endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    const Car = require('./models/Cars');
    const count = await Car.countDocuments();
    res.json({
      status: 'Database connection successful',
      carCount: count,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database test failed:', error);
    res.status(500).json({
      status: 'Database connection failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Cancel booking endpoint
app.post('/api/cars/:carId/cancel', async (req, res) => {
  try {
    const { carId } = req.params;
    const { transactionHash, blockNumber, cancelledBy } = req.body;

    // Update car availability and add cancellation info
    const updatedCar = await Car.findOneAndUpdate(
      { carId: carId },
      {
        $set: {
          isAvailable: true,
          'rental.isActive': false,
          'rental.cancelledAt': new Date(),
          'rental.cancelledBy': cancelledBy,
          'rental.cancellationTxHash': transactionHash,
          'rental.cancellationBlockNumber': blockNumber
        }
      },
      { new: true }
    );

    if (!updatedCar) {
      return res.status(404).json({ error: 'Car not found' });
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      car: updatedCar
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// Complete rental endpoint
app.post('/api/cars/:carId/complete', async (req, res) => {
  try {
    const { carId } = req.params;
    const {
      transactionHash,
      blockNumber,
      returnedBy,
      returnCondition,
      returnNotes,
      fuelLevel
    } = req.body;

    // Update car availability and add completion info
    const updatedCar = await Car.findOneAndUpdate(
      { carId: carId },
      {
        $set: {
          isAvailable: true,
          'rental.isActive': false,
          'rental.completedAt': new Date(),
          'rental.returnedBy': returnedBy,
          'rental.returnCondition': returnCondition,
          'rental.returnNotes': returnNotes,
          'rental.fuelLevel': fuelLevel,
          'rental.completionTxHash': transactionHash,
          'rental.completionBlockNumber': blockNumber
        }
      },
      { new: true }
    );

    if (!updatedCar) {
      return res.status(404).json({ error: 'Car not found' });
    }

    res.json({
      success: true,
      message: 'Rental completed successfully',
      car: updatedCar
    });
  } catch (error) {
    console.error('Error completing rental:', error);
    res.status(500).json({ error: 'Failed to complete rental' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error details:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body
  });

  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

const connectDB = require('./db');

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Frontend should connect to: http://localhost:${PORT}/api`);
    console.log(`🔗 MongoDB URI: ${process.env.MONGO_URI ? 'Connected to Atlas' : 'Using local MongoDB'}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`🧪 Database test: http://localhost:${PORT}/api/test-db`);

    // Test the database connection
    setTimeout(async () => {
      try {
        const Car = require('./models/Cars');
        const count = await Car.countDocuments();
        console.log(`📊 Database status: ${count} cars in database`);
      } catch (error) {
        console.error('❌ Database connection test failed:', error.message);
      }
    }, 2000);
  });
}).catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⏹️  Shutting down server...');
  try {
    await mongoose.connection.close();
    console.log('📦 Database connection closed');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

module.exports = app;