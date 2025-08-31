const mongoose = require('mongoose');

const ParticipantSchema = new mongoose.Schema({
  user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  email: { type: String, required: true, lowercase: true, trim: true },
  share: { type: Number, required: true, min: 0 }
}, { _id: false });

const SplitExpenseSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'SplitGroup', required: true, index: true },

  paidBy: {
    user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    email: { type: String, required: true, lowercase: true, trim: true }
  },

  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, default: 'BDT' },

  description: { type: String, trim: true },
  category: { type: String, trim: true },
  date: { type: Date, default: Date.now },

  splitType: { type: String, enum: ['equal','shares','exact','percent'], default: 'equal' },

  participants: { type: [ParticipantSchema], default: [] }
}, { timestamps: true });

// Rounding guard
SplitExpenseSchema.pre('save', function(next) {
  this.amount = Math.round(this.amount * 100) / 100;
  if (Array.isArray(this.participants)) {
    this.participants = this.participants.map(p => ({
      ...p,
      share: Math.round(Number(p.share || 0) * 100) / 100
    }));
  }
  next();
});

// Participants validation
SplitExpenseSchema.path('participants').validate(function(parts) {
  if (!Array.isArray(parts) || parts.length === 0) return false;

  const emails = new Set();
  let sum = 0;

  for (const p of parts) {
    if (!p?.email) return false;
    if (emails.has(p.email)) return false;
    emails.add(p.email);

    if (!(p.share >= 0)) return false;
    sum += Number(p.share || 0);
  }

  sum = Math.round(sum * 100) / 100;
  const amt = Math.round(Number(this.amount || 0) * 100) / 100;

  return Math.abs(sum - amt) <= 0.01;
}, 'Participants must be unique, non-empty, non-negative, and sum to the expense amount.');

// Helpful indexes
SplitExpenseSchema.index({ group: 1, createdAt: -1 });
SplitExpenseSchema.index({ group: 1, 'paidBy.email': 1, createdAt: -1 });

// Pretty JSON
SplitExpenseSchema.set('toJSON', {
  versionKey: false,
  virtuals: true,
  transform: (_doc, ret) => { ret.id = ret._id; delete ret._id; }
});

module.exports = mongoose.model('SplitExpense', SplitExpenseSchema);
