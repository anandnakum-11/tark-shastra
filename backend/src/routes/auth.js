const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const User = require('../models/User');
const logger = require('../utils/logger');

function buildToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function getUsernameCandidates(username) {
  const normalized = String(username || '').trim().toLowerCase();
  const localPart = normalized.includes('@') ? normalized.split('@')[0] : normalized;

  return Array.from(new Set([normalized, localPart])).filter(Boolean);
}

router.post('/register', async (req, res) => {
  try {
    const { username, password, role, name, phone, department } = req.body;
    const email = String(username || '').trim().toLowerCase();

    if (!email || !password || !role || !name) {
      return res.status(400).json({ error: 'username, password, role, and name are required.' });
    }

    const existing = await User.findOne({
      where: {
        [Op.or]: [
          { email },
          { name: String(name).trim() },
        ],
      },
    });

    if (existing) {
      return res.status(409).json({ error: 'A user with this email or name already exists.' });
    }

    const user = await User.create({
      email,
      password,
      role: String(role).trim().toLowerCase(),
      name: String(name).trim(),
      phone: phone || null,
      department: department || null,
    });

    const token = buildToken(user);
    logger.info(`User registered: ${user.email} (${user.role})`);
    res.status(201).json({ user, token });
  } catch (err) {
    logger.error(`Registration error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const candidates = getUsernameCandidates(username);
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: { [Op.in]: candidates } },
          { name: { [Op.in]: candidates } },
          { email: { [Op.iLike]: `${candidates[0]}@%` } },
        ],
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = buildToken(user);
    logger.info(`User logged in: ${user.email}`);
    res.json({ user, token });
  } catch (err) {
    logger.error(`Login error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
