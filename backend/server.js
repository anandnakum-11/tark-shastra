require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./src/config/db');
const { connectRedis } = require('./src/config/redis');
const logger = require('./src/utils/logger');
const { startWorkers } = require('./src/queues/workers');

const app = express();

// ── Security & Parsing ──────────────────────────────
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiting ────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// ── API Routes ───────────────────────────────────────
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/grievances', require('./src/routes/grievance'));
app.use('/api/ivr', require('./src/routes/ivr'));
app.use('/api/evidence', require('./src/routes/evidence'));
app.use('/api/departments', require('./src/routes/department'));
app.use('/api/collector', require('./src/routes/collector'));

// ── Health Check ─────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    name: 'SakshyaAI – Smart Grievance Verification System',
    timestamp: new Date().toISOString(),
    mockMode: process.env.MOCK_MODE === 'true'
  });
});

// ── 404 Handler ──────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Error Handler ────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ── Boot ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

async function boot() {
  try {
    await connectDB();
    logger.info('✅ PostgreSQL connected');

    await connectRedis();
    logger.info('✅ Redis connected');

    startWorkers();
    logger.info('✅ BullMQ workers started');

    app.listen(PORT, () => {
      logger.info(`🚀 SakshyaAI backend running on port ${PORT}`);
      logger.info(`   Mock mode: ${process.env.MOCK_MODE === 'true' ? 'ON' : 'OFF'}`);
    });
  } catch (err) {
    logger.error('Failed to boot server:', err);
    process.exit(1);
  }
}

boot();

module.exports = app;
