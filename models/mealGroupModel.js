const mongoose = require('mongoose');

const MemberSchema = new mongoose.Schema({
  user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  email: { type: String, required: true, lowercase: true, trim: true },
  name:  { type: String, trim: true, default: '' },
  role:  { type: String, enum: ['admin','member'], default: 'member' },
  joinedAt: { type: Date, default: Date.now }
}, { _id: false });

const MealGroupSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  members:   { type: [MemberSchema], default: [] },
}, { timestamps: true });

MealGroupSchema.index({ 'members.email': 1 });

MealGroupSchema.pre('save', function(next) {
  if (!Array.isArray(this.members)) this.members = [];
  const seen = new Set();
  const norm = [];
  for (const m of this.members) {
    if (!m || !m.email) continue;
    const email = String(m.email).toLowerCase().trim();
    if (seen.has(email)) continue;
    seen.add(email);
    norm.push({ user: m.user, email, name: (m.name||'').trim(), role: m.role === 'admin' ? 'admin' : 'member', joinedAt: m.joinedAt || new Date() });
  }
  this.members = norm;
  if (!this.members.some(m => m.role === 'admin') && this.members.length) {
    this.members[0].role = 'admin';
  }
  next();
});

MealGroupSchema.set('toJSON', {
  versionKey: false,
  virtuals: true,
  transform: (_doc, ret) => { ret.id = ret._id; delete ret._id; }
});

module.exports = mongoose.model('MealGroup', MealGroupSchema);
