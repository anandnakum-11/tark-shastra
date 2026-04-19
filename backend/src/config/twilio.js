const twilio = require('twilio');
const logger = require('../utils/logger');

let twilioClient = null;

function isLocalUrl(url) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/i.test(String(url || ''));
}

function getTwilioWebhookBaseUrl() {
  return String(process.env.PUBLIC_BASE_URL || process.env.BASE_URL || '').replace(/\/$/, '');
}

function getLocalPortHint() {
  try {
    return new URL(process.env.BASE_URL || 'http://localhost:5000').port || process.env.PORT || '5000';
  } catch (error) {
    return process.env.PORT || '5000';
  }
}

function assertTwilioConfig({ allowLocalWebhook = false } = {}) {
  const required = process.env.MOCK_MODE === 'true'
    ? []
    : [
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'TWILIO_PHONE_NUMBER',
    ];
  const missing = required.filter((key) => !process.env[key]);
  const webhookBaseUrl = getTwilioWebhookBaseUrl();

  if (!webhookBaseUrl) {
    missing.push('PUBLIC_BASE_URL or BASE_URL');
  }

  if (missing.length) {
    throw new Error(`Missing Twilio configuration: ${missing.join(', ')}`);
  }

  if (process.env.MOCK_MODE !== 'true' && isLocalUrl(webhookBaseUrl) && !allowLocalWebhook) {
    throw new Error(
      `Twilio real-call mode needs a public HTTPS webhook URL. Start a tunnel for port ${getLocalPortHint()} and set PUBLIC_BASE_URL to that HTTPS URL, or set MOCK_MODE=true for local testing.`
    );
  }

  return webhookBaseUrl;
}

function getTwilioClient() {
  if (!twilioClient) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    twilioClient = twilio(sid, token);
  }
  return twilioClient;
}

async function makeIvrCall(toPhone, grievanceId) {
  const baseUrl = assertTwilioConfig();
  const { generateWelcomeTwiml } = require('../services/ivrService');

  const encodedGrievanceId = encodeURIComponent(grievanceId);
  const statusCallback = `${baseUrl}/api/ivr/status?grievanceId=${encodedGrievanceId}`;
  const twiml = generateWelcomeTwiml(grievanceId, baseUrl);

  if (process.env.MOCK_MODE === 'true') {
    logger.info(`[MOCK TWILIO] IVR call to ${toPhone} for grievance ${grievanceId}`);
    logger.info(`[MOCK TWILIO] Inline TwiML generated for grievance ${grievanceId}`);
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
    twiml,
    statusCallback,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    statusCallbackMethod: 'POST',
  });

  logger.info(`Twilio call created: SID=${call.sid}, to=${toPhone}`);
  return { sid: call.sid, status: call.status, to: toPhone, mock: false };
}

module.exports = { getTwilioClient, makeIvrCall, assertTwilioConfig, isLocalUrl, getTwilioWebhookBaseUrl };
