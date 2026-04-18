const { Worker } = require('bullmq');
const { getRedisConnection, isRedisAvailable } = require('../../config/redis');
const { makeIvrCall } = require('../../config/twilio');
const logger = require('../../utils/logger');

let workers = [];

function startWorkers() {
  if (!isRedisAvailable()) {
    logger.warn('Redis not available — BullMQ workers not started. Using direct processing mode.');
    return;
  }
  try {
    const connection = getRedisConnection();

    // ── Main Verification Worker ─────────────────
    const verifyWorker = new Worker('verification', async (job) => {
      const { grievanceId, complainantPhone } = job.data;
      logger.info(`[Worker] Processing verify_grievance job for ${grievanceId}`);

      // Step 1: Trigger IVR call to complainant
      try {
        const callResult = await makeIvrCall(complainantPhone, grievanceId);
        logger.info(`[Worker] IVR call initiated: ${JSON.stringify(callResult)}`);
      } catch (err) {
        logger.error(`[Worker] IVR call failed: ${err.message}`);
        throw err; // This will trigger retry
      }

      // Step 2: Notify field officer (in real system, push notification)
      logger.info(`[Worker] Field officer notified for grievance ${grievanceId}`);

      // Step 3: Schedule evidence check (would be a delayed job in production)
      logger.info(`[Worker] Evidence check scheduled for ${grievanceId} (${process.env.EVIDENCE_TIMEOUT_HOURS || 24}h timeout)`);

      return { success: true, grievanceId };
    }, {
      connection,
      concurrency: 5,
    });

    verifyWorker.on('completed', (job) => {
      logger.info(`[Worker] Job ${job.id} completed for grievance ${job.data.grievanceId}`);
    });

    verifyWorker.on('failed', (job, err) => {
      logger.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
    });

    workers.push(verifyWorker);
    logger.info('BullMQ workers started successfully');
  } catch (err) {
    logger.warn(`Could not start BullMQ workers: ${err.message}. Queue processing disabled.`);
  }
}

function stopWorkers() {
  workers.forEach(w => w.close());
  workers = [];
}

module.exports = { startWorkers, stopWorkers };
