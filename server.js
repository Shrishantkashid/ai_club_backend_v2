const express = require('express');
const cors = require('cors');
require('dotenv').config();
const mongoose = require('mongoose');

const contestRoutes = require('./routes/contest');

const app = express();
const PORT = process.env.PORT || 5000;

// Configure CORS properly for development and production
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000', // Allow your frontend domain
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

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
  });