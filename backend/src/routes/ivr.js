const router = require('express').Router();
const Grievance = require('../models/Grievance');
const VerificationLog = require('../models/VerificationLog');
const validateTwilio = require('../middleware/validateTwilio');
const { generateWelcomeTwiml, generateResponseTwiml } = require('../services/ivrService');
const { CITIZEN_RESPONSE } = require('../utils/constants');
const logger = require('../utils/logger');

// ── POST /api/ivr/welcome — Twilio requests TwiML when call connects ──
router.post('/welcome', validateTwilio, (req, res) => {
  const { grievanceId } = req.query;
  logger.info(`IVR welcome webhook for grievance: ${grievanceId}`);

  const twiml = generateWelcomeTwiml(grievanceId);
  res.type('text/xml');
  res.send(twiml);
});

// ── POST /api/ivr/response — Twilio sends DTMF digit ──
router.post('/response', validateTwilio, async (req, res) => {
  try {
    const { grievanceId } = req.query;
    const digits = req.body.Digits;
    const callSid = req.body.CallSid || 'unknown';

    logger.info(`IVR response: grievance=${grievanceId}, digits=${digits}, callSid=${callSid}`);

    // Find the latest verification log
    const verLog = await VerificationLog.findOne({ grievance: grievanceId }).sort({ createdAt: -1 });
    if (verLog) {
      if (digits === '1') {
        verLog.citizenResponse = CITIZEN_RESPONSE.CONFIRMED;
      } else if (digits === '2') {
        verLog.citizenResponse = CITIZEN_RESPONSE.DISPUTED;
      } else {
        verLog.citizenResponse = CITIZEN_RESPONSE.NO_RESPONSE;
      }
      verLog.ivrTimestamp = new Date();
      verLog.ivrCallSid = callSid;
      await verLog.save();
      logger.info(`Citizen response recorded: ${verLog.citizenResponse} for grievance ${grievanceId}`);
    }

    const twiml = generateResponseTwiml(digits);
    res.type('text/xml');
    res.send(twiml);
  } catch (err) {
    logger.error(`IVR response error: ${err.message}`);
    res.status(500).send('<Response><Say>Error occurred.</Say></Response>');
  }
});

// ── POST /api/ivr/status — Twilio call status callback ──
router.post('/status', validateTwilio, async (req, res) => {
  try {
    const { grievanceId } = req.query;
    const { CallSid, CallStatus, CallDuration } = req.body;

    logger.info(`IVR status callback: grievance=${grievanceId}, status=${CallStatus}, duration=${CallDuration}`);

    // If call failed or wasn't answered, mark as NO_RESPONSE
    if (['no-answer', 'busy', 'failed', 'canceled'].includes(CallStatus)) {
      const verLog = await VerificationLog.findOne({ grievance: grievanceId }).sort({ createdAt: -1 });
      if (verLog && verLog.citizenResponse === 'PENDING') {
        verLog.citizenResponse = CITIZEN_RESPONSE.NO_RESPONSE;
        verLog.ivrTimestamp = new Date();
        verLog.ivrCallSid = CallSid;
        verLog.ivrCallDuration = parseInt(CallDuration) || 0;
        verLog.notes = `Call status: ${CallStatus}`;
        await verLog.save();
        logger.info(`Call failed/unanswered for grievance ${grievanceId}. Marked as NO_RESPONSE.`);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    logger.error(`IVR status error: ${err.message}`);
    res.sendStatus(200); // Always return 200 to Twilio
  }
});

module.exports = router;
