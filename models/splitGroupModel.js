const mongoose = require('mongoose');

const MemberSchema = new mongoose.Schema({
  user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  email: { type: String, required: true, lowercase: true, trim: true },
  name:  { type: String, trim: true, default: '' },
  role:  { type: String, enum: ['admin','member'], default: 'member' },
  joinedAt: { type: Date, default: Date.now }
}, { _id: false });

const SplitGroupSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  members:   { type: [MemberSchema], default: [] },
}, { timestamps: true });


SplitGroupSchema.index({ 'members.email': 1 });

SplitGroupSchema.pre('save', function(next) {
  if (!Array.isArray(this.members)) this.members = [];

  const seen = new Set();
  const normalized = [];
  for (const m of this.members) {
    if (!m || !m.email) continue;
    const email = String(m.email).toLowerCase().trim();
    if (seen.has(email)) continue;
    seen.add(email);
    normalized.push({
      user: m.user,
      email,
      name: typeof m.name === 'string' ? m.name.trim() : '',
      role: m.role === 'admin' ? 'admin' : 'member',
      joinedAt: m.joinedAt || new Date()
    });
  }
  this.members = normalized;

  if (!this.members.some(m => m.role === 'admin')) {
    const idx = Math.max(0, this.members.findIndex(m => m.user?.toString?.() === this.createdBy?.toString?.()));
    this.members[idx >= 0 ? idx : 0].role = 'admin';
  }

  next();
});

SplitGroupSchema.path('members').validate(function(members) {
  if (!Array.isArray(members) || members.length === 0) return false;
  const emails = new Set();
  for (const m of members) {
    if (!m?.email) return false;
    if (emails.has(m.email)) return false;
    emails.add(m.email);
  }
  return true;
}, 'Members must be non-empty and have unique emails.');

SplitGroupSchema.methods.isMember = function(email) {
  const e = (email || '').toLowerCase().trim();
  return this.members.some(m => m.email === e);
};
SplitGroupSchema.methods.isAdmin = function(email) {
  const e = (email || '').toLowerCase().trim();
  return this.members.some(m => m.email === e && m.role === 'admin');
};

SplitGroupSchema.set('toJSON', {
  versionKey: false,
  virtuals: true,
  transform: (_doc, ret) => { ret.id = ret._id; delete ret._id; }
});

module.exports = mongoose.model('SplitGroup', SplitGroupSchema);
