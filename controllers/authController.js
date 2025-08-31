const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const generateOTP = require('../utils/generateOTP');
const sendEmail = require('../utils/sendEmail');
const { addToBlacklist } = require('../utils/tokenBlacklist');

const FIRST_LOGIN_CODE_TTL_MIN = parseInt(process.env.FIRST_LOGIN_CODE_TTL_MIN || '10');
const JWT_EXPIRES = process.env.JWT_EXPIRES || '1d';

function signJwt(user, extra = {}) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role, ...extra },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// Internal helper to send first-time login code
async function sendFirstLoginCode(user) {
  const code = generateOTP();

  // Save hashed code + TTL first (so verification works even if email fails)
  user.firstLoginCodeHash = await bcrypt.hash(code, 10);
  user.firstLoginCodeExpiresAt = new Date(Date.now() + FIRST_LOGIN_CODE_TTL_MIN * 60 * 1000);
  await user.save();

  // In non-production, print the code to the server console so you can test without SMTP
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV] First-login code for ${user.email} => ${code}`);
  }

  // Try sending the email, but don't break the flow in dev if it fails
  try {
    await sendEmail({
      to: user.email,
      subject: 'Your first-time login verification code',
      text: `Your code is ${code}. It expires in ${FIRST_LOGIN_CODE_TTL_MIN} minutes.`,
      html: `<p>Your code is <b>${code}</b>. It expires in ${FIRST_LOGIN_CODE_TTL_MIN} minutes.</p>`
    });
  } catch (err) {
    console.error('[EMAIL ERROR] Failed to send first-login code:', err.message);
    // Optional: in production you may want to rethrow to force a visible failure
    if (process.env.NODE_ENV === 'production') throw err;
  }
}

// POST /auth/signup
exports.signup = async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    if (!name || !username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // pre-check (still keep DB unique indexes for safety)
    const exists = await User.findOne({ $or: [{ email: normalizedEmail }, { username }] });
    if (exists) {
      const which = exists.email === normalizedEmail ? 'email' : 'username';
      return res.status(409).json({ message: `User with this ${which} already exists.` });
    }

    await User.create({ name, username, email: normalizedEmail, password });
    return res.status(201).json({ message: 'Signup successful. Please login.' });
  } catch (err) {
    // ---- better diagnostics & proper HTTP codes
    console.error('signup error:', err);

    // duplicate key (MongoServerError: E11000 duplicate key)
    if (err && (err.code === 11000 || err.name === 'MongoServerError')) {
      const field = err.keyPattern ? Object.keys(err.keyPattern)[0] : 'field';
      return res.status(409).json({ message: `Duplicate ${field}.` });
    }

    // mongoose validation
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ message: 'Validation failed.', errors: messages });
    }

    return res.status(500).json({ message: 'Internal server error.' });
  }
};


// POST /auth/login
// If password ok & firstLoginVerified=false -> send code and block with 403.
exports.login = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    if (!emailOrUsername || !password) {
      return res.status(400).json({ message: 'Email/Username and password required.' });
    }

    const user = await User.findOne({
      $or: [{ email: emailOrUsername.toLowerCase().trim() }, { username: emailOrUsername }]
    });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials.' });

    if (!user.firstLoginVerified) {
      if (!user.firstLoginCodeExpiresAt || user.firstLoginCodeExpiresAt < new Date()) {
        await sendFirstLoginCode(user);
      }
      return res.status(403).json({ message: 'First login verification required. Check your email for the code.' });
    }

    const token = signJwt(user, { isTwoFAVerified: !user.isTwoFAEnabled });
    return res.status(200).json({ message: 'Login successful', token, user: user.toJSON() });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

// POST /auth/request-first-login-code
exports.requestFirstLoginCode = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.firstLoginVerified) return res.status(400).json({ message: 'Already verified.' });

    await sendFirstLoginCode(user);
    return res.status(200).json({ message: 'Verification code sent.' });
  } catch (err) {
    console.error('login error:', err);        // add this if missing
    console.error(err?.stack);                 // <- shows the real reason
    return res.status(500).json({ message: 'Internal server error.' });
  }

};

// POST /auth/verify-first-login-code
exports.verifyFirstLoginCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: 'Email and code are required.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.firstLoginVerified) return res.status(400).json({ message: 'Already verified.' });

    if (!user.firstLoginCodeHash || !user.firstLoginCodeExpiresAt || user.firstLoginCodeExpiresAt < new Date()) {
      return res.status(400).json({ message: 'Code missing or expired.' });
    }

    const ok = await bcrypt.compare(code, user.firstLoginCodeHash);
    if (!ok) return res.status(400).json({ message: 'Invalid code.' });

    user.firstLoginVerified = true;
    user.firstLoginCodeHash = null;
    user.firstLoginCodeExpiresAt = null;
    await user.save();

    const token = signJwt(user, { isTwoFAVerified: !user.isTwoFAEnabled });
    return res.status(200).json({ message: 'First login verified.', token, user: user.toJSON() });
  } catch (err) {
    console.error('verifyFirstLoginCode error', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

// POST /auth/logout
exports.logout = async (req, res) => {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'No token provided.' });

    addToBlacklist(token);
    return res.status(200).json({ message: 'Logout successful.' });
  } catch (err) {
    console.error('logout error', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};
