// server.js - Updated backend server
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const carRoutes = require('./routes/cars');
app.use('/api/cars', carRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Car Rental API Server is running!',
    version: '1.0.0',
    endpoints: {
      cars: '/api/cars',
      health: '/health'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const connectDB = require('./db');

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Frontend should connect to: http://localhost:${PORT}/api`);
    console.log(`🔗 MongoDB URI: ${process.env.MONGO_URI}`);
  });
});


// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⏹️  Shutting down server...');
  await mongoose.connection.close();
  console.log('📦 Database connection closed');
  process.exit(0);
});

module.exports = app;