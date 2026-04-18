const IORedis = require('ioredis');
const logger = require('../utils/logger');

let connection = null;
let redisAvailable = false;

function getRedisConnection() {
  if (!connection) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    connection = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 2000,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 1) return null; // Give up after 1 retry
        return 500;
      },
    });
    connection.on('error', () => {
      // Suppress repeated error logs
    });
  }
  return connection;
}

async function connectRedis() {
  try {
    const conn = getRedisConnection();
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000));
    await Promise.race([conn.connect(), timeout]);
    await conn.ping();
    redisAvailable = true;
    logger.info('Redis connected');
  } catch (err) {
    redisAvailable = false;
    logger.warn(`Redis not available. Running without queues (direct processing mode).`);
  }
}

function isRedisAvailable() {
  return redisAvailable;
}

module.exports = { getRedisConnection, connectRedis, isRedisAvailable };
