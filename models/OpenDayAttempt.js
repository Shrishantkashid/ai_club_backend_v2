const mongoose = require('mongoose');

const openDayAttemptSchema = new mongoose.Schema({
    name: { type: String, required: true },
    usn: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    initialPhoto: { type: String }, // Base64 or path
    finalPhoto: { type: String },   // Base64 or path
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    completedPuzzles: [{
        name: String,
        completed: Boolean,
        timeTaken: Number, // seconds
        timestamp: { type: Date, default: Date.now }
    }],
    feedback: {
        rating: Number,
        comments: String,
        timestamp: { type: Date }
    },
    verificationToken: { type: String },
    isVerified: { type: Boolean, default: false },
    verificationTime: { type: Date }
});

module.exports = mongoose.model('OpenDayAttempt', openDayAttemptSchema);
