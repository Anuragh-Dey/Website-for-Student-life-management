const mongoose = require('mongoose');

const EmergencyFundSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, required: true },

  // Goal
  targetAmount: { type: Number, min: 0, default: 0 },
  targetMonths: { type: Number, min: 0, default: 0 }, // 3–6 typical
  targetDate:   { type: Date, default: null },

  // Current state
  currentBalance: { type: Number, min: 0, default: 0 },
  monthlyPlan:    { type: Number, min: 0, default: 0 }, // suggested monthly contribution

  // Gamification
  badges: [{
    type: String,
    enum: ['10%', '25%', '50%', '75%', '100%', '3mo', '6mo', '12mo', 'Streak3', 'Streak6', 'Streak12']
  }],
  streakCount: { type: Number, default: 0 },
  lastContributionAt: { type: Date, default: null },
}, { timestamps: true });

EmergencyFundSchema.index({ user: 1 }, { unique: true });

module.exports = mongoose.model('EmergencyFund', EmergencyFundSchema);
