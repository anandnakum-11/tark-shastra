const router = require('express').Router();
const VerificationLog = require('../models/VerificationLog');
const validateTwilio = require('../middleware/validateTwilio');
const { generateWelcomeTwiml, generateResponseTwiml } = require('../services/ivrService');
const { CITIZEN_RESPONSE } = require('../utils/constants');
const { evaluateVerification } = require('../services/verificationEngine');
const logger = require('../utils/logger');

async function getLatestVerificationLog(grievanceId) {
  return VerificationLog.findOne({
    where: { grievanceId },
    order: [['created_at', 'DESC']],
  });
}

router.post('/welcome', validateTwilio, (req, res) => {
  const { grievanceId } = req.query;
  logger.info(`IVR welcome webhook for grievance: ${grievanceId}`);

  const twiml = generateWelcomeTwiml(grievanceId);
  res.type('text/xml');
  res.send(twiml);
});

router.post('/response', validateTwilio, async (req, res) => {
  try {
    const { grievanceId } = req.query;
    const digits = req.body.Digits;

    const verificationLog = await getLatestVerificationLog(grievanceId);
    if (verificationLog) {
      verificationLog.ivrResult = digits === '1'
        ? CITIZEN_RESPONSE.CONFIRMED
        : digits === '2'
          ? CITIZEN_RESPONSE.DISPUTED
          : CITIZEN_RESPONSE.NO_RESPONSE;
      await verificationLog.save();
    }

    try {
      await evaluateVerification(grievanceId);
    } catch (evaluationError) {
      logger.error(`IVR evaluation error for grievance ${grievanceId}: ${evaluationError.message}`);
    }

    const twiml = generateResponseTwiml(digits);
    res.type('text/xml');
    res.send(twiml);
  } catch (err) {
    logger.error(`IVR response error: ${err.message}`);
    res.status(500).send('<Response><Say>Error occurred.</Say></Response>');
  }
});

router.post('/status', validateTwilio, async (req, res) => {
  try {
    const { grievanceId } = req.query;
    const { CallStatus } = req.body;

    if (['no-answer', 'busy', 'failed', 'canceled'].includes(CallStatus)) {
      const verificationLog = await getLatestVerificationLog(grievanceId);
      if (verificationLog && !verificationLog.ivrResult) {
        verificationLog.ivrResult = CITIZEN_RESPONSE.NO_RESPONSE;
        await verificationLog.save();
      }

      try {
        await evaluateVerification(grievanceId);
      } catch (evaluationError) {
        logger.error(`IVR no-response evaluation error for grievance ${grievanceId}: ${evaluationError.message}`);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    logger.error(`IVR status error: ${err.message}`);
    res.sendStatus(200);
  }
});

module.exports = router;
