const { Queue } = require('bullmq');
const { getRedisConnection, isRedisAvailable } = require('../config/redis');
const logger = require('../utils/logger');

let queue = null;

function getQueue() {
  if (!queue && isRedisAvailable()) {
    try {
      const connection = getRedisConnection();
      queue = new Queue('verification', { connection });
      logger.info('BullMQ verification queue created');
    } catch (err) {
      logger.warn(`Could not create BullMQ queue: ${err.message}`);
    }
  }
  return queue;
}

module.exports = { getQueue };
