const express = require('express');
const cors = require('cors');
require('dotenv').config();
const mongoose = require('mongoose');

const contestRoutes = require('./routes/contest');
const contestSem2Routes = require('./routes/contestSem2');
const openDayRoutes = require('./routes/openDay');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all origins - for production, you might want to be more specific
app.use(cors({
  origin: '*', // Allow all origins for now
  credentials: true,
  optionsSuccessStatus: 200
}));

// Middleware to parse JSON
app.use(express.json());

// Routes
app.use('/api/contest', contestRoutes);
app.use('/api/contest/sem2', contestSem2Routes);
app.use('/api/open-day', openDayRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'AI Club Backend API is running!' });
});

// Connect to MongoDB with better connection options
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds instead of 30
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  minPoolSize: 5,
  connectTimeoutMS: 10000,
  retryWrites: true,
  w: 'majority'
})
  .then(() => {
    console.log('✅ Connected to MongoDB successfully');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error.message);
    console.log('⚠️  Attempting to use fallback connection...');
    
    // Try alternative connection approach
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected');
    });
    
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
    
    // Start server anyway for health checks
    app.listen(PORT, () => {
      console.log(`⚠️  Server running on port ${PORT} (MongoDB connection failed - check Atlas credentials)`);
      console.log('💡 Please verify:');
      console.log('   1. MongoDB Atlas cluster is running');
      console.log('   2. IP whitelist includes 0.0.0.0/0 (all IPs)');
      console.log('   3. Database user credentials are correct');
      console.log('   4. Connection string format is correct');
    });
  });