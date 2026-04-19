const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }

    // attach plain object
    req.user = user.get ? user.get() : user;
    next();
  } catch (err) {
    logger.warn(`Auth error: ${err.message}`);
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = authMiddleware;
