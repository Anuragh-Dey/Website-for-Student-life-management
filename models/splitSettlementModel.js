const mongoose = require('mongoose');

const SplitSettlementSchema = new mongoose.Schema({
  group:  { type: mongoose.Schema.Types.ObjectId, ref: 'SplitGroup', required: true, index: true },
  from:   { email: { type: String, required: true, lowercase: true, trim: true } },
  to:     { email: { type: String, required: true, lowercase: true, trim: true } },
  amount: { type: Number, required: true, min: 0.01 },
  note:   { type: String, trim: true },
  date:   { type: Date, default: Date.now }
}, { timestamps: true });

/** Extra indexes (optional but useful) */
SplitSettlementSchema.index({ group: 1, 'from.email': 1, createdAt: -1 });
SplitSettlementSchema.index({ group: 1, 'to.email': 1, createdAt: -1 });

/** Prevent self-transfer and normalize/round amount */
SplitSettlementSchema.pre('validate', function(next) {
  if (this.from?.email && this.to?.email && this.from.email === this.to.email) {
    return next(new Error('fromEmail and toEmail must be different'));
  }
  next();
});

SplitSettlementSchema.pre('save', function(next) {
  this.amount = Math.round(Number(this.amount || 0) * 100) / 100;
  next();
});

/** Pretty JSON */
SplitSettlementSchema.set('toJSON', {
  versionKey: false,
  virtuals: true,
  transform: (_doc, ret) => { ret.id = ret._id; delete ret._id; }
});

module.exports = mongoose.model('SplitSettlement', SplitSettlementSchema);
