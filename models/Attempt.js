const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  round1_score: {
    type: Number,
    default: 0
  },
  round2_score: {
    type: Number,
    default: 0
  },
  round3_score: {
    type: Number,
    default: 0
  },
  total_points: {
    type: Number,
    default: 0
  },
  accuracy: {
    type: Number,
    default: 0
  },
  time_taken: {
    type: Number,
    default: 0
  },
  is_disqualified: {
    type: Boolean,
    default: false
  },
  warning_count: {
    type: Number,
    default: 0
  },
  submitted_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Attempt', attemptSchema);