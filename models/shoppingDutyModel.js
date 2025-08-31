const mongoose = require('mongoose');

const ShoppingDutySchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'MealGroup', required: true, index: true },
  date:  { type: Date, required: true, index: true }, // duty day (normalized to 00:00)
  email: { type: String, required: true, lowercase: true, trim: true },
  note:  { type: String, trim: true }
}, { timestamps: true });

ShoppingDutySchema.index({ group: 1, date: 1 }, { unique: true }); // one assignee per day per group

ShoppingDutySchema.set('toJSON', {
  versionKey: false,
  virtuals: true,
  transform: (_doc, ret) => { ret.id = ret._id; delete ret._id; }
});

module.exports = mongoose.model('ShoppingDuty', ShoppingDutySchema);
