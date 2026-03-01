const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Attempt = require('../models/Attempt');
const router = express.Router();

// JWT Secret - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET;

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Valid email is required' });
    }
    
    // Check if user exists, if not create new user
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      user = await User.create({
        email: email.toLowerCase(),
        status: 'ACTIVE',
        reset_count: 0
      });
    }

    // Check if this user has already attempted the contest
    const existingAttempt = await Attempt.findOne({ user_id: user._id });
    if (existingAttempt) {
      return res.status(400).json({ 
        message: 'You have already attempted the contest. Access denied.' 
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Submit Round 1
router.post('/round1/submit', authenticateToken, async (req, res) => {
  try {
    const { answers, totalQuestions, correctAnswers, autoSubmit, warningCount } = req.body;
    const userId = req.user.userId;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has already submitted an attempt
    const existingAttempt = await Attempt.findOne({ user_id: userId });
    if (existingAttempt) {
      return res.status(400).json({ message: 'Attempt already submitted' });
    }

    // Calculate score (out of 100 for better granularity)
    const round1Score = Math.round((correctAnswers / totalQuestions) * 100);
    const accuracy = Math.round((correctAnswers / totalQuestions) * 100);

    // Determine if user should be disqualified
    // Only disqualify if autoSubmit is true AND warning count exceeded threshold (e.g., 3 warnings)
    const is_disqualified = autoSubmit && (warningCount >= 3);

    // Create attempt
    const attempt = await Attempt.create({
      user_id: userId,
      round1_score: round1Score,
      round2_score: 0, // Will be updated later
      round3_score: 0, // Will be updated later
      accuracy: accuracy,
      time_taken: 0, // Will be calculated with round2
      is_disqualified: is_disqualified,
      warning_count: warningCount || 0
    });

    res.json({ 
      success: true, 
      message: 'Round 1 submitted successfully',
      score: round1Score,
      accuracy: accuracy,
      attemptId: attempt._id
    });
  } catch (error) {
    console.error('Round 1 submission error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Submit Round 2
router.post('/round2/submit', authenticateToken, async (req, res) => {
  try {
    const { moves, timeTaken, completed } = req.body;
    const userId = req.user.userId;

    // Find the user's attempt
    let attempt = await Attempt.findOne({ user_id: userId });
    if (!attempt) {
      return res.status(404).json({ message: 'No active attempt found' });
    }

    // Check if this attempt is already disqualified
    if (attempt.is_disqualified) {
      return res.status(400).json({ message: 'Your attempt has been disqualified' });
    }

    // Calculate round 2 points based on moves and time
    // Fewer moves and faster time = more points
    let round2Score = 0;
    if (completed) {
      const movePoints = Math.max(0, 100 - moves); // 100 points max, minus moves
      const timePoints = Math.max(0, 200 - Math.floor(timeTaken / 2)); // 200 points max, minus time/2
      round2Score = movePoints + timePoints;
    }

    // Calculate total points (all 3 rounds)
    const totalPoints = attempt.round1_score + round2Score + attempt.round3_score;
    
    // Calculate overall accuracy
    const round1Accuracy = attempt.round1_score; // Already out of 100
    const round2Accuracy = completed ? 100 : 0;
    const round3Accuracy = attempt.round3_score > 0 ? 100 : 0;
    const overallAccuracy = Math.round((round1Accuracy + round2Accuracy + round3Accuracy) / 3);

    // Update the attempt
    attempt = await Attempt.findOneAndUpdate(
      { user_id: userId },
      {
        round2_score: round2Score,
        accuracy: overallAccuracy,
        time_taken: timeTaken, // Total time for round 2
        total_points: totalPoints
      },
      { new: true }
    );

    res.json({ 
      success: true, 
      message: 'Round 2 submitted successfully',
      score: round2Score,
      accuracy: attempt.accuracy
    });
  } catch (error) {
    console.error('Round 2 submission error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    // Get all attempts, populated with user data
    const attempts = await Attempt.find({ is_disqualified: false })
      .populate('user_id', 'email')
      .sort({ total_points: -1, time_taken: 1 }) // Sort by total points descending, then by time ascending
      .exec();

    const leaderboard = attempts.map(attempt => ({
      userId: attempt.user_id._id.toString(),
      email: attempt.user_id.email,
      round1Score: attempt.round1_score,
      round2Score: attempt.round2_score,
      round3Score: attempt.round3_score || 0,
      totalPoints: attempt.total_points || (attempt.round1_score + attempt.round2_score),
      accuracy: Math.round(attempt.accuracy),
      timeTaken: attempt.time_taken,
      isDisqualified: attempt.is_disqualified,
      submittedAt: attempt.submitted_at
    }));

    res.json({ 
      leaderboard,
      totalParticipants: leaderboard.length
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Administrative endpoint to clear all test data
router.delete('/admin/clear-data', (req, res) => {
  // Note: This endpoint may need authentication in production
  try {
    // In a real MongoDB implementation, you would use:
    // await User.deleteMany({});
    // await Attempt.deleteMany({});
    
    res.json({ 
      success: true, 
      message: 'Test data clearing is not implemented in this version' 
    });
  } catch (error) {
    console.error('Clear data error:', error);
    res.status(500).json({ message: 'Failed to clear data' });
  }
});

module.exports = router;