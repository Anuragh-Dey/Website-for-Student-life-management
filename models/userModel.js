const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name:     { type: String, trim: true },
  username: { type: String, unique: true, required: true, trim: true },
  email:    { type: String, unique: true, required: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },

  role: { type: String, enum: ['user', 'admin'], default: 'user' },

  // First-time login email verification
  firstLoginVerified:      { type: Boolean, default: false },
  firstLoginCodeHash:      { type: String, default: null },
  firstLoginCodeExpiresAt: { type: Date,   default: null },

  // Hooks for future 2FA if you want later
  isTwoFAEnabled:    { type: Boolean, default: false },
  twoFAToken:        { type: String, default: null },
  twoFATokenExpires: { type: Date,   default: null },
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const rounds = parseInt(process.env.SALT_ROUNDS || '10');
  this.password = await bcrypt.hash(this.password, rounds);
  next();
});

userSchema.methods.comparePassword = function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.firstLoginCodeHash;
    delete ret.twoFAToken;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
