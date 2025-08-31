const mongoose = require('mongoose');

const FundTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fund: { type: mongoose.Schema.Types.ObjectId, ref: 'EmergencyFund', required: true, index: true },
  type: { type: String, enum: ['deposit', 'withdrawal', 'adjustment'], required: true },
  amount: { type: Number, min: 0.01, required: true },
  note: { type: String, trim: true },
}, { timestamps: true });

FundTransactionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('FundTransaction', FundTransactionSchema);
