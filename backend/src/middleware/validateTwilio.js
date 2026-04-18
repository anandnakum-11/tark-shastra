const twilio = require('twilio');
const logger = require('../utils/logger');

/**
 * Validate Twilio webhook signature (skip in mock mode).
 */
function validateTwilio(req, res, next) {
  if (process.env.MOCK_MODE === 'true') {
    return next();
  }

  const twilioSignature = req.headers['x-twilio-signature'];
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const url = `${process.env.BASE_URL}${req.originalUrl}`;

  const isValid = twilio.validateRequest(authToken, twilioSignature, url, req.body);
  if (!isValid) {
    logger.warn('Invalid Twilio signature');
    return res.status(403).send('Forbidden');
  }
  next();
}

module.exports = validateTwilio;
