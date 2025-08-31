const mongoose = require('mongoose');

const MealEntrySchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'MealGroup', required: true, index: true },
  email: { type: String, required: true, lowercase: true, trim: true }, // who ate
  date:  { type: Date, required: true },                                 // when
  meal:  { type: String, enum: ['breakfast','lunch','dinner','other'], required: true },
  servings: { type: Number, default: 1, min: 0.1 }
}, { timestamps: true });

MealEntrySchema.index({ group: 1, date: 1 });
MealEntrySchema.index({ group: 1, email: 1, date: 1 });

MealEntrySchema.pre('save', function(next) {
  this.servings = Math.round(Number(this.servings) * 100) / 100;
  next();
});

MealEntrySchema.set('toJSON', {
  versionKey: false,
  virtuals: true,
  transform: (_doc, ret) => { ret.id = ret._id; delete ret._id; }
});

module.exports = mongoose.model('MealEntry', MealEntrySchema);
