const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AttemptSem2 = require('../models/AttemptSem2');
const router = express.Router();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET;

// Helper function to generate email from name and semester
const generateEmail = (fullName, semester) => {
  // Allow up to 20 characters (database limit)
  const namePart = fullName.toLowerCase().replace(/\s+/g, '').substring(0, 30);
  
  let suffix;
  switch(semester) {
    case 2: suffix = '.25cs@saividya.ac.in'; break;
    case 4: suffix = '.24cs@saividya.ac.in'; break;
    case 6: suffix = '.23cs@saividya.ac.in'; break;
    default: suffix = '.25cs@saividya.ac.in';
  }
  
  return `${namePart}${suffix}`;
};

// Helper function to generate password from name
const generatePassword = (fullName) => {
  const first4 = fullName.substring(0, 4).toLowerCase();
  return `${first4}2026`;
};

// Helper function to handle duplicate passwords
const generateUniquePassword = async (baseName) => {
  const first4 = baseName.substring(0, 4).toLowerCase();
  let password = `${first4}2026`;
  
  // Check if password already exists
  let existingUser = await User.findOne({ password });
  let counter = 1;
  
  while (existingUser) {
    password = `${first4}${counter}2026`;
    existingUser = await User.findOne({ password });
    counter++;
  }
  
  return password;
};

// ==================== AUTHENTICATION ====================

// Login route for 2nd sem contest (supports both registration and login)
router.post('/login', async (req, res) => {
  try {
    const { fullName, semester, isLoginAttempt } = req.body;
    
    console.log('Login/Register attempt:', { fullName, semester, isLoginAttempt });
    
    // Validate inputs
    if (!fullName || !semester) {
      return res.status(400).json({ message: 'Full name and semester are required' });
    }
    
    if (![2, 4, 6].includes(semester)) {
      return res.status(400).json({ message: 'Semester must be 2, 4, or 6' });
    }
    
    // Generate email from name and semester
    const email = generateEmail(fullName, semester);
    
    // Check if user exists with this email (across ALL semesters)
    let user = await User.findOne({ email });
    
    if (user) {
      // Email already exists - check if it's the same person
      const normalizedExistingName = (user.full_name || '').toLowerCase().replace(/\s+/g, '');
      const normalizedNewName = fullName.toLowerCase().replace(/\s+/g, '');
      
      console.log('Name comparison debug:');
      console.log('  Existing name (raw):', `'${user.full_name || 'NULL'}'`);
      console.log('  Input name (raw):', `'${fullName}'`);
      console.log('  Existing name (normalized):', `'${normalizedExistingName}'`);
      console.log('  Input name (normalized):', `'${normalizedNewName}'`);
      console.log('  Names match:', normalizedExistingName === normalizedNewName);
      
      // If names match (same person)
      if (normalizedExistingName === normalizedNewName) {
        // Check if this is a LOGIN attempt or REGISTRATION attempt
        if (isLoginAttempt) {
          // ✅ LOGIN MODE - Allow access
          console.log('Existing user logged in:', email);
          
          // Update semester if different
          if (user.semester !== semester) {
            console.log(`Updating semester from ${user.semester} to ${semester} for ${email}`);
            user.semester = semester;
            await user.save();
          }
          // Continue to allow access
        } else {
          // ❌ REGISTRATION MODE - Block and force login
          console.log('Existing user tried to re-register:', email);
          return res.status(400).json({ 
            message: `⚠️ You already have an account! Please use the Login tab to sign in with your existing credentials.`,
            emailExists: true,
            existingEmail: email,
            existingSemester: user.semester,
            existingName: user.full_name || 'Unknown'
          });
        }
      } else {
        // Different person with similar name - email collision
        console.log('Name mismatch - existing:', user.full_name, 'vs input:', fullName);
        return res.status(400).json({ 
          message: `An account with email ${email} already exists for Semester ${user.semester}, but the name doesn't match. If this is your account, please use the exact same name: "${user.full_name || 'Unknown'}"`,
          emailExists: true,
          existingEmail: email,
          existingSemester: user.semester,
          existingName: user.full_name || 'Unknown'
        });
      }
    } else {
      // No existing account found
      if (isLoginAttempt) {
        // ❌ LOGIN MODE - Account doesn't exist, block login
        console.log('Login attempt failed - no account found:', fullName, semester);
        return res.status(400).json({ 
          message: `No account found with this name and semester. Please register first using the Register tab.`,
          needsRegistration: true
        });
      } else {
        // ✅ REGISTRATION MODE - Create new account
        const password = generatePassword(fullName);
        user = await User.create({
          email,
          full_name: fullName,
          semester,
          password,
          status: 'ACTIVE'
        });
        console.log('New user created:', email);
      }
    }
    
    // Check if user has any attempt record
    const existingAttempt = await AttemptSem2.findOne({ 
      user_id: user._id
    });
    
    if (existingAttempt) {
      // Check if contest is fully completed
      if (existingAttempt.contest_end_time) {
        // Contest completed - show leaderboard
        const leaderboardData = await getLeaderboard();
        const userRank = leaderboardData.findIndex(entry => entry.userId === user._id.toString()) + 1;
        const userEntry = leaderboardData.find(entry => entry.userId === user._id.toString());
        
        return res.json({
          contestCompleted: true,
          message: 'Contest has been completed. Here are your results!',
          user: {
            id: user._id.toString(),
            email: user.email,
            full_name: user.full_name || '',
            semester: user.semester,
            status: user.status
          },
          userRank,
          userData: userEntry,
          leaderboard: leaderboardData,
          totalParticipants: leaderboardData.length
        });
      }
      
      // Contest in progress - determine which round to continue
      let nextRound = 'sem2-round1';
      
      // Check Round 1 completion
      if (existingAttempt.round1_score !== undefined && existingAttempt.round1_score !== null) {
        // Round 1 completed, check Round 2
        nextRound = 'sem2-round2';
        
        if (existingAttempt.round2_score !== undefined && existingAttempt.round2_score !== null) {
          // Round 2 completed, check Round 3
          nextRound = 'sem2-round3';
          
          if (existingAttempt.round3_score !== undefined && existingAttempt.round3_score !== null) {
            // All rounds completed but contest_end_time not set - submit final
            try {
              // Calculate total time and points
              const endTime = new Date();
              const startTime = existingAttempt.contest_start_time || existingAttempt.round1_start_time;
              const totalTimeSeconds = Math.floor((endTime - startTime) / 1000);
              
              existingAttempt.contest_end_time = endTime;
              existingAttempt.total_time_seconds = totalTimeSeconds;
              existingAttempt.total_points = (existingAttempt.round1_score || 0) + 
                                            (existingAttempt.round2_score || 0) + 
                                            (existingAttempt.round3_score || 0);
              await existingAttempt.save();
              
              // Now show leaderboard
              const leaderboardData = await getLeaderboard();
              const userRank = leaderboardData.findIndex(entry => entry.userId === user._id.toString()) + 1;
              const userEntry = leaderboardData.find(entry => entry.userId === user._id.toString());
              
              return res.json({
                contestCompleted: true,
                message: 'Contest has been completed. Here are your results!',
                user: {
                  id: user._id.toString(),
                  email: user.email,
                  full_name: user.full_name || '',
                  semester: user.semester,
                  status: user.status
                },
                userRank,
                userData: userEntry,
                leaderboard: leaderboardData,
                totalParticipants: leaderboardData.length
              });
            } catch (error) {
              console.error('Error finalizing contest:', error);
            }
          }
        }
      }
      
      // Return current progress and next round
      return res.json({
        contestInProgress: true,
        nextRound: nextRound,
        currentRound: existingAttempt.round1_score ? 'sem2-round2' : 'sem2-round1',
        message: 'Continuing contest from where you left off',
        user: {
          id: user._id.toString(),
          email: user.email,
          full_name: user.full_name || '',
          semester: user.semester,
          status: user.status
        },
        progress: {
          round1Completed: !!existingAttempt.round1_score,
          round2Completed: !!existingAttempt.round2_score,
          round3Completed: !!existingAttempt.round3_score
        }
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
        full_name: user.full_name || '',
        semester: user.semester,
        status: user.status
      },
      message: 'Login successful'
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin login route
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    // Check if admin credentials
    if (email === 'admin@gmail.com' && password === 'admin123') {
      let adminUser = await User.findOne({ email });
      
      if (!adminUser) {
        adminUser = await User.create({
          email: email.toLowerCase(),
          full_name: 'Admin',
          semester: 0,
          password: 'admin123',
          status: 'ADMIN'
        });
      }
      
      const token = jwt.sign(
        { userId: adminUser._id, email: adminUser.email, isAdmin: true },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      return res.json({
        token,
        user: {
          id: adminUser._id.toString(),
          email: adminUser.email,
          status: 'ADMIN'
        }
      });
    }
    
    return res.status(401).json({ message: 'Invalid admin credentials' });
    
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ==================== MIDDLEWARE ====================

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

// Admin middleware
const isAdmin = (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// ==================== ROUND 1 ====================

// Get C Programming Questions
router.get('/round1/questions', authenticateToken, async (req, res) => {
  try {
    // C Programming MCQs - 25 questions
    const questions = [
      {
        id: 1,
        question: "What is the output of:\nint x = 5;\nprintf(\"%d\", x++);",
        options: ["5", "6", "Error", "Undefined"],
      },
      {
        id: 2,
        question: "Which keyword is used to declare a constant in C?",
        options: ["final", "const", "define", "constant"],
      },
      {
        id: 3,
        question: "What is the size of int in C (typically)?",
        options: ["2 bytes", "4 bytes", "8 bytes", "Depends on compiler"],
      },
      {
        id: 4,
        question: "Which operator is used to access the value at an address?",
        options: ["&", "*", "->", "."],
      },
      {
        id: 5,
        question: "What does NULL represent?",
        options: ["0", "1", "-1", "None of these"],
      },
      {
        id: 6,
        question: "Which function is used to allocate memory dynamically?",
        options: ["alloc()", "malloc()", "new()", "calloc()"],
      },
      {
        id: 7,
        question: "What is the correct syntax to print in C?",
        options: ["print()", "echo()", "printf()", "cout"],
      },
      {
        id: 8,
        question: "Which loop is guaranteed to execute at least once?",
        options: ["for", "while", "do-while", "None"],
      },
      {
        id: 9,
        question: "What is the output of:\nint a = 10;\nprintf(\"%d\", ++a);",
        options: ["10", "11", "Error", "Undefined"],
      },
      {
        id: 10,
        question: "Which header file is needed for mathematical functions?",
        options: ["stdio.h", "stdlib.h", "math.h", "string.h"],
      },
      {
        id: 11,
        question: "What is the purpose of break statement?",
        options: ["Exit loop", "Continue loop", "Skip iteration", "None"],
      },
      {
        id: 12,
        question: "Which is the correct format specifier for float?",
        options: ["%d", "%f", "%lf", "%ld"],
      },
      {
        id: 13,
        question: "What does getchar() do?",
        options: ["Print character", "Read character", "Delete character", "None"],
      },
      {
        id: 14,
        question: "Which symbol is used for single line comment?",
        options: ["/* */", "//", "#", "--"],
      },
      {
        id: 15,
        question: "What is the output of:\nint x = 2;\nprintf(\"%d\", x << 1);",
        options: ["2", "4", "1", "0"],
      },
      {
        id: 16,
        question: "Which function is used to free allocated memory?",
        options: ["delete", "remove()", "free()", "dealloc()"],
      },
      {
        id: 17,
        question: "What is strlen(\"Hello\")?",
        options: ["4", "5", "6", "7"],
      },
      {
        id: 18,
        question: "Which operator has highest precedence?",
        options: ["+", "*", "==", "&&"],
      },
      {
        id: 19,
        question: "What is the return type of main() by default?",
        options: ["void", "int", "float", "char"],
      },
      {
        id: 20,
        question: "How many bytes does a char occupy?",
        options: ["1", "2", "4", "8"],
      },
      {
        id: 21,
        question: "What does sizeof() return?",
        options: ["Value", "Address", "Size in bytes", "None"],
      },
      {
        id: 22,
        question: "Which is a valid variable name?",
        options: ["2var", "_var", "var-name", "int"],
      },
      {
        id: 23,
        question: "What is the output of 5 % 2?",
        options: ["2", "1", "0", "2.5"],
      },
      {
        id: 24,
        question: "Which statement is used to come out of a loop?",
        options: ["continue", "break", "return", "exit"],
      },
      {
        id: 25,
        question: "What is the ASCII value of 'A'?",
        options: ["64", "65", "66", "97"],
      }
    ];
    
    res.json({ questions });
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Submit Round 1
router.post('/round1/submit', authenticateToken, async (req, res) => {
  try {
    const { answers, startTime } = req.body;
    const userId = req.user.userId;
    
    // Find or create attempt
    let attempt = await AttemptSem2.findOne({ user_id: userId });
    
    if (!attempt) {
      attempt = await AttemptSem2.create({
        user_id: userId,
        contest_start_time: startTime || new Date(),
        round1_start_time: startTime || new Date()
      });
    }
    
    // Calculate score - 1 point per correct answer
    const correctAnswers = Object.values(answers).filter(v => v.isCorrect).length;
    const totalQuestions = Object.keys(answers).length;
    const round1Score = correctAnswers; // 1 point per correct answer
    
    // Update attempt
    attempt.round1_answers = Object.entries(answers).map(([questionId, answer]) => ({
      questionId,
      selectedAnswer: answer.selectedAnswer,
      isCorrect: answer.isCorrect,
      timestamp: answer.timestamp || new Date()
    }));
    attempt.round1_score = round1Score;
    attempt.round1_end_time = new Date();
    
    await attempt.save();
    
    res.json({
      success: true,
      score: round1Score,
      correctAnswers,
      totalQuestions
    });
    
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ==================== ROUND 2 ====================

// Submit individual activity
router.post('/round2/activity/submit', authenticateToken, async (req, res) => {
  try {
    const { activityName, moves, timeTaken, completed } = req.body;
    const userId = req.user.userId;
    
    let attempt = await AttemptSem2.findOne({ user_id: userId });
    
    if (!attempt) {
      return res.status(404).json({ message: 'No active attempt found' });
    }
    
    // Add activity to completed list
    attempt.round2_activities_completed.push({
      activityName,
      moves,
      timeTaken,
      completed,
      timestamp: new Date()
    });
    
    await attempt.save();
    
    res.json({
      success: true,
      message: 'Activity submitted successfully',
      activitiesCompleted: attempt.round2_activities_completed.length
    });
    
  } catch (error) {
    console.error('Activity submit error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Submit Round 2
router.post('/round2/submit', authenticateToken, async (req, res) => {
  try {
    const { endTime } = req.body;
    const userId = req.user.userId;
    
    let attempt = await AttemptSem2.findOne({ user_id: userId });
    
    if (!attempt) {
      return res.status(404).json({ message: 'No active attempt found' });
    }
    
    // Calculate round 2 score based on completed activities
    const activities = attempt.round2_activities_completed;
    const completedCount = activities.filter(a => a.completed).length;
    
    // Base score for completing activities + bonus for speed and efficiency
    let round2Score = 0;
    if (completedCount >= 3) {
      round2Score = 100; // Base completion score
      
      // Bonus for each activity
      activities.forEach(activity => {
        if (activity.completed) {
          const moveBonus = Math.max(0, 50 - activity.moves);
          const timeBonus = Math.max(0, 30 - Math.floor(activity.timeTaken / 10));
          round2Score += moveBonus + timeBonus;
        }
      });
    }
    
    attempt.round2_score = round2Score;
    attempt.round2_end_time = endTime ? new Date(endTime) : new Date();
    
    await attempt.save();
    
    res.json({
      success: true,
      score: round2Score,
      activitiesCompleted: completedCount
    });
    
  } catch (error) {
    console.error('Round 2 submit error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ==================== ROUND 3 ====================

// Submit individual task
router.post('/round3/task/submit', authenticateToken, async (req, res) => {
  try {
    const { taskType, taskNumber, userAnswer, isCorrect } = req.body;
    const userId = req.user.userId;
    
    let attempt = await AttemptSem2.findOne({ user_id: userId });
    
    if (!attempt) {
      return res.status(404).json({ message: 'No active attempt found' });
    }
    
    // Add task answer
    attempt.round3_task_answers.push({
      taskType,
      taskNumber,
      userAnswer,
      isCorrect,
      timestamp: new Date()
    });
    
    await attempt.save();
    
    res.json({
      success: true,
      message: 'Task submitted successfully'
    });
    
  } catch (error) {
    console.error('Task submit error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Submit riddle answer
router.post('/round3/riddle/submit', authenticateToken, async (req, res) => {
  try {
    const { riddleQuestion, userAnswer, isCorrect, keyLetter } = req.body;
    const userId = req.user.userId;
    
    let attempt = await AttemptSem2.findOne({ user_id: userId });
    
    if (!attempt) {
      return res.status(404).json({ message: 'No active attempt found' });
    }
    
    // Add riddle answer
    attempt.round3_riddle_answers.push({
      riddleQuestion,
      userAnswer,
      isCorrect,
      keyLetter,
      timestamp: new Date()
    });
    
    await attempt.save();
    
    res.json({
      success: true,
      message: 'Riddle submitted successfully',
      keyLetter
    });
    
  } catch (error) {
    console.error('Riddle submit error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Submit Round 3
router.post('/round3/submit', authenticateToken, async (req, res) => {
  try {
    const { endTime, escapeKey } = req.body;
    const userId = req.user.userId;
    
    let attempt = await AttemptSem2.findOne({ user_id: userId });
    
    if (!attempt) {
      return res.status(404).json({ message: 'No active attempt found' });
    }
    
    // Calculate round 3 score
    const taskAnswers = attempt.round3_task_answers;
    const riddleAnswers = attempt.round3_riddle_answers;
    
    const correctTasks = taskAnswers.filter(t => t.isCorrect).length;
    const correctRiddles = riddleAnswers.filter(r => r.isCorrect).length;
    
    let round3Score = 0;
    if (correctTasks === 4 && correctRiddles === 4) {
      // Base completion score
      round3Score = 200;
      
      // Time bonus
      const timeTaken = (new Date(endTime) - attempt.round3_start_time) / 1000;
      round3Score += Math.max(0, 100 - Math.floor(timeTaken / 5));
    }
    
    attempt.round3_score = round3Score;
    attempt.round3_end_time = endTime ? new Date(endTime) : new Date();
    
    // Calculate total time and finalize contest
    attempt.contest_end_time = new Date();
    attempt.total_time_seconds = Math.floor((attempt.contest_end_time - attempt.contest_start_time) / 1000);
    attempt.total_points = attempt.round1_score + attempt.round2_score + attempt.round3_score;
    attempt.accuracy = Math.round((attempt.total_points / 300) * 100); // Max possible ~300
    
    await attempt.save();
    
    res.json({
      success: true,
      score: round3Score,
      totalTime: attempt.total_time_seconds,
      totalPoints: attempt.total_points,
      escapeKey
    });
    
  } catch (error) {
    console.error('Round 3 submit error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ==================== LEADERBOARD ====================

// Helper function to get leaderboard
const getLeaderboard = async () => {
  // Show all attempts (including in-progress) so Round 1 scores are visible
  const attempts = await AttemptSem2.find({ 
    is_disqualified: false
  })
  .populate('user_id', 'email full_name semester')
  .sort({ total_points: -1, total_time_seconds: 1 })
  .exec();
  
  return attempts
    .filter(entry => entry.user_id !== null)
    .map((entry, index) => ({
      userId: entry.user_id._id.toString(),
      email: entry.user_id.email,
      fullName: entry.user_id.full_name || '',
      semester: entry.user_id.semester,
      round1Score: entry.round1_score || 0,
      round2Score: entry.round2_score || 0,
      round3Score: entry.round3_score || 0,
      totalPoints: entry.total_points || 0,
      totalTime: entry.total_time_seconds || 0,
      accuracy: entry.accuracy || 0,
      rank: index + 1
    }));
};

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const leaderboard = await getLeaderboard();
    
    res.json({
      leaderboard,
      totalParticipants: leaderboard.length
    });
    
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ==================== ADMIN ROUTES ====================

// Get all attempts (Admin only)
router.get('/admin/attempts', authenticateToken, isAdmin, async (req, res) => {
  try {
    const attempts = await AttemptSem2.find()
      .populate('user_id', 'email full_name semester')
      .sort({ submitted_at: -1 });
    
    res.json({ attempts });
    
  } catch (error) {
    console.error('Get attempts error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get specific attempt details (Admin only)
router.get('/admin/attempts/:userId', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const attempt = await AttemptSem2.findOne({ user_id: userId })
      .populate('user_id', 'email full_name semester');
    
    if (!attempt) {
      return res.status(404).json({ message: 'Attempt not found' });
    }
    
    res.json({ attempt });
    
  } catch (error) {
    console.error('Get attempt details error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
