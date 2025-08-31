const mongoose = require('mongoose');

const GroceryItemSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'MealGroup', required: true, index: true },

  name:     { type: String, required: true, trim: true },
  quantity: { type: Number, default: 1 },
  unit:     { type: String, trim: true }, // e.g., kg, pcs

  neededForDate: { type: Date },          // optional (for planning)
  neededForMeal: { type: String, enum: ['breakfast','lunch','dinner','other', null], default: null },

  purchased:     { type: Boolean, default: false },
  amount:        { type: Number, min: 0 },           // total cost when purchased
  paidByEmail:   { type: String, lowercase: true, trim: true },
  purchasedAt:   { type: Date }
}, { timestamps: true });

GroceryItemSchema.index({ group: 1, purchased: 1, createdAt: -1 });

GroceryItemSchema.pre('save', function(next) {
  if (this.amount != null) this.amount = Math.round(Number(this.amount) * 100) / 100;
  next();
});

GroceryItemSchema.set('toJSON', {
  versionKey: false,
  virtuals: true,
  transform: (_doc, ret) => { ret.id = ret._id; delete ret._id; }
});

module.exports = mongoose.model('GroceryItem', GroceryItemSchema);
