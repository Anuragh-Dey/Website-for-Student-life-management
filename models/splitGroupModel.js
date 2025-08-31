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

/** Indexes */
SplitGroupSchema.index({ 'members.email': 1 });
/* Optional: enforce unique group names per creator (uncomment if you want this)
SplitGroupSchema.index({ name: 1, createdBy: 1 }, { unique: true });
*/

/** Normalize members on save (lowercase emails, trim, and ensure at least one admin) */
SplitGroupSchema.pre('save', function(next) {
  if (!Array.isArray(this.members)) this.members = [];

  // normalize emails + dedupe within the group
  const seen = new Set();
  const normalized = [];
  for (const m of this.members) {
    if (!m || !m.email) continue;
    const email = String(m.email).toLowerCase().trim();
    if (seen.has(email)) continue; // drop duplicates
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

  // must have at least one admin
  if (!this.members.some(m => m.role === 'admin')) {
    // If creator is a member, make them admin; else promote the first member
    const idx = Math.max(0, this.members.findIndex(m => m.user?.toString?.() === this.createdBy?.toString?.()));
    this.members[idx >= 0 ? idx : 0].role = 'admin';
  }

  next();
});

/** Validators: non-empty members, unique emails inside the group */
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

/** Convenience methods */
SplitGroupSchema.methods.isMember = function(email) {
  const e = (email || '').toLowerCase().trim();
  return this.members.some(m => m.email === e);
};
SplitGroupSchema.methods.isAdmin = function(email) {
  const e = (email || '').toLowerCase().trim();
  return this.members.some(m => m.email === e && m.role === 'admin');
};

/** Pretty JSON */
SplitGroupSchema.set('toJSON', {
  versionKey: false,
  virtuals: true,
  transform: (_doc, ret) => { ret.id = ret._id; delete ret._id; }
});

module.exports = mongoose.model('SplitGroup', SplitGroupSchema);
