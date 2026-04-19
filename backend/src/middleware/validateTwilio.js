const twilio = require('twilio');
const logger = require('../utils/logger');
const { getTwilioWebhookBaseUrl } = require('../config/twilio');

/**
 * Validate Twilio webhook signature (skip in mock mode).
 */
function validateTwilio(req, res, next) {
  if (process.env.MOCK_MODE === 'true') {
    return next();
  }

  const twilioSignature = req.headers['x-twilio-signature'];
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const baseUrl = getTwilioWebhookBaseUrl();
  if (!twilioSignature || !authToken || !baseUrl) {
    logger.warn('Twilio signature validation skipped because signature, auth token, or BASE_URL is missing');
    return res.status(403).send('Forbidden');
  }

  const url = `${baseUrl}${req.originalUrl}`;

  const isValid = twilio.validateRequest(authToken, twilioSignature, url, req.body);
  if (!isValid) {
    logger.warn('Invalid Twilio signature');
    return res.status(403).send('Forbidden');
  }
  next();
}

module.exports = validateTwilio;
