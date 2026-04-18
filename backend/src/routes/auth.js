const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// ── POST /api/auth/register ──────────────────
router.post('/register', async (req, res) => {
  try {
    const { username, password, role, name, phone, department } = req.body;

    if (!username || !password || !role || !name) {
      return res.status(400).json({ error: 'username, password, role, and name are required.' });
    }

    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Username already exists.' });
    }

    const user = await User.create({
      username: username.toLowerCase(),
      hashedPassword: password,
      role,
      name,
      phone: phone || '',
      department: department || undefined,
    });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    logger.info(`User registered: ${user.username} (${user.role})`);
    res.status(201).json({ user, token });
  } catch (err) {
    logger.error(`Registration error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/login ─────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    logger.info(`User logged in: ${user.username}`);
    res.json({ user, token });
  } catch (err) {
    logger.error(`Login error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
