const express = require('express');
const router = express.Router();
const OpenDayAttempt = require('../models/OpenDayAttempt');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

// Configure Nodemailer (Placeholder - User should update with real SMTP)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    }
});

// Register initial entry
router.post('/register', async (req, res) => {
    try {
        const { name, usn, email, initialPhoto } = req.body;
        
        const attempt = new OpenDayAttempt({
            name,
            usn,
            email,
            initialPhoto,
            verificationToken: uuidv4()
        });
        
        await attempt.save();
        res.status(201).json({ message: 'Entry registered', attemptId: attempt._id });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Save puzzle progress
router.post('/puzzle/submit', async (req, res) => {
    try {
        const { attemptId, puzzleName, timeTaken } = req.body;
        
        const attempt = await OpenDayAttempt.findById(attemptId);
        if (!attempt) return res.status(404).json({ message: 'Attempt not found' });
        
        attempt.completedPuzzles.push({
            name: puzzleName,
            completed: true,
            timeTaken
        });
        
        await attempt.save();
        res.json({ message: 'Progress saved' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Submit feedback and trigger verification email
router.post('/feedback', async (req, res) => {
    try {
        const { attemptId, rating, comments } = req.body;
        
        const attempt = await OpenDayAttempt.findById(attemptId);
        if (!attempt) return res.status(404).json({ message: 'Attempt not found' });
        
        attempt.feedback = {
            rating,
            comments,
            timestamp: new Date()
        };
        attempt.endTime = new Date();
        
        await attempt.save();
        
        // Send verification email
        const verifyLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/#/open-day/verify?token=${attempt.verificationToken}&usn=${attempt.usn}`;
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: attempt.email,
            subject: 'AI Club Open Day - Attendance Verification',
            html: `
                <div style="font-family: Arial, sans-serif; color: #0a192f; background: #f0f4f8; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #64ffda; background: #0a192f; padding: 10px; border-radius: 5px;">AI Club SVIT</h2>
                    <p>Hi <strong>${attempt.name}</strong>,</p>
                    <p>Thank you for participating in the AI Club Open Day activities!</p>
                    <p>To finalize your attendance and receive credit, please click the link below to verify your identity:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${verifyLink}" style="background: #64ffda; color: #0a192f; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 30px; box-shadow: 0 4px 15px rgba(100, 255, 218, 0.3);">Verify Attendance Now</a>
                    </div>
                    <p style="font-size: 0.8rem; color: #64748b;">If the button doesn't work, copy this link: ${verifyLink}</p>
                    <hr style="border: 0; border-top: 1px solid #cbd5e0; margin: 20px 0;">
                    <p style="font-size: 0.8rem; text-align: center;">© 2026 SVIT AI Club</p>
                </div>
            `
        };

        // We don't await here to not block the user, or we can await for reliability
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) console.error('Email error:', error);
            else console.log('Email sent:', info.response);
        });
        
        res.json({ message: 'Feedback saved and verification email sent' });
    } catch (error) {
        console.error('Feedback error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get attempt details for verification page
router.get('/details', async (req, res) => {
    try {
        const { token, usn } = req.query;
        const attempt = await OpenDayAttempt.findOne({ verificationToken: token, usn }, { name: 1, usn: 1, isVerified: 1 });
        
        if (!attempt) return res.status(404).json({ message: 'Invalid verification link' });
        res.json(attempt);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Final verification
router.post('/verify', async (req, res) => {
    try {
        const { token, usn, finalPhoto } = req.body;
        
        const attempt = await OpenDayAttempt.findOne({ verificationToken: token, usn });
        if (!attempt) return res.status(404).json({ message: 'Invalid verification link' });
        
        if (attempt.isVerified) return res.status(400).json({ message: 'Already verified' });
        
        attempt.finalPhoto = finalPhoto;
        attempt.isVerified = true;
        attempt.verificationTime = new Date();
        
        await attempt.save();
        res.json({ message: 'Attendance verified successfully', name: attempt.name });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
