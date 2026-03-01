const express = require('express');
const { users } = require('./db'); // Import shared users map
const router = express.Router();

// Admin reset feature
router.post('/reset-user/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find user by ID
    let userFound = false;
    let userEmail = null;
    
    for (let [email, user] of users.entries()) {
      if (user.id === userId) {
        // Update user status
        user.status = 'ACTIVE';
        user.reset_count = (user.reset_count || 0) + 1;
        users.set(email, user);
        userFound = true;
        userEmail = email;
        break;
      }
    }
    
    if (!userFound) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Log reset activity
    console.log(`Admin reset performed for user ${userId} (${userEmail}). Reset count: ${users.get(userEmail).reset_count}`);
    
    res.json({ 
      success: true, 
      message: 'User reset successfully',
      resetCount: users.get(userEmail).reset_count
    });
  } catch (error) {
    console.error('Admin reset error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;