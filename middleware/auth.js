// middleware/auth.js
const jwt = require('jsonwebtoken');
const { isBlacklisted } = require('../utils/tokenBlacklist');

module.exports = function auth(required = true) {
  return (req, res, next) => {
    // Let CORS preflight through
    if (req.method === 'OPTIONS') return next();

    // Accept Bearer header (case-insensitive) or cookie named "token"
    const authz = req.headers.authorization || '';
    const m = authz.match(/^Bearer\s+(.+)$/i);
    const headerToken = m ? m[1].trim() : null;
    const cookieToken = req.cookies?.token; // requires cookie-parser if you want this
    const token = headerToken || cookieToken || null;

    if (!token) {
      if (!required) { req.user = null; return next(); }
      return res.status(401).json({ message: 'No token provided' });
    }

    if (isBlacklisted(token)) {
      return res.status(401).json({ message: 'Token blacklisted' });
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET /* , { algorithms: ['HS256'] } */);
      req.user = payload; // { id, email, role, ... }
      return next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired' });
      }
      return res.status(401).json({ message: 'Invalid token' });
    }
  };
};
