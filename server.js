const express = require('express');
const cors = require('cors');
require('dotenv').config();
const mongoose = require('mongoose');

const contestRoutes = require('./routes/contest');

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

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'AI Club Backend API is running!' });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    console.log('Please check your MongoDB Atlas connection string in .env file');
    console.log('Make sure the cluster name and credentials are correct');
    // Still start the server to allow health checks
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} (without MongoDB connection)`);
    });
  });