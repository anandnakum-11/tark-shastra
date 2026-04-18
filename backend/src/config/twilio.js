const twilio = require('twilio');
const logger = require('../utils/logger');

let twilioClient = null;

function getTwilioClient() {
  if (!twilioClient) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    twilioClient = twilio(sid, token);
  }
  return twilioClient;
}

async function makeIvrCall(toPhone, grievanceId) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const url = `${baseUrl}/api/ivr/welcome?grievanceId=${grievanceId}`;
  const statusCallback = `${baseUrl}/api/ivr/status?grievanceId=${grievanceId}`;

  if (process.env.MOCK_MODE === 'true') {
    logger.info(`[MOCK TWILIO] IVR call to ${toPhone} for grievance ${grievanceId}`);
    logger.info(`[MOCK TWILIO] TwiML URL: ${url}`);
    return {
      sid: `MOCK_CALL_${Date.now()}`,
      status: 'queued',
      to: toPhone,
      mock: true,
    };
  }

  const client = getTwilioClient();
  const call = await client.calls.create({
    to: toPhone,
    from: process.env.TWILIO_PHONE_NUMBER,
    url,
    statusCallback,
    statusCallbackEvent: ['completed', 'no-answer', 'busy', 'failed'],
    statusCallbackMethod: 'POST',
  });

  logger.info(`Twilio call created: SID=${call.sid}, to=${toPhone}`);
  return { sid: call.sid, status: call.status, to: toPhone, mock: false };
}

module.exports = { getTwilioClient, makeIvrCall };
