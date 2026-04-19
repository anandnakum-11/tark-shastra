const VoiceResponse = require('twilio').twiml.VoiceResponse;
const { getTwilioWebhookBaseUrl } = require('../config/twilio');

function say(twiml, text) {
  twiml.say(text);
}

function buildWebhookUrl(baseUrl, path) {
  const normalizedBaseUrl = String(baseUrl || getTwilioWebhookBaseUrl() || '').replace(/\/$/, '');
  return normalizedBaseUrl ? `${normalizedBaseUrl}${path}` : path;
}

function generateWelcomeTwiml(grievanceId, baseUrl) {
  const twiml = new VoiceResponse();

  const gather = twiml.gather({
    numDigits: 1,
    action: buildWebhookUrl(baseUrl, `/api/ivr/response?grievanceId=${encodeURIComponent(grievanceId)}`),
    method: 'POST',
    timeout: 10,
    actionOnEmptyResult: true,
  });

  say(
    gather,
    'Select 1 or 2. Press 1 if your complaint is resolved. Press 2 if your complaint is not resolved.'
  );

  say(twiml, 'No response received. The grievance will be reopened. Thank you.');

  return twiml.toString();
}

function generateResponseTwiml(digit) {
  const twiml = new VoiceResponse();

  if (digit === '1') {
    say(twiml, 'Thank you. Your response has been recorded. Field verification is now unlocked.');
  } else if (digit === '2') {
    say(twiml, 'Thank you. Your response has been recorded. The grievance will be reopened.');
  } else {
    say(twiml, 'Invalid input received. The grievance will be reopened.');
  }

  return twiml.toString();
}

module.exports = { generateWelcomeTwiml, generateResponseTwiml, buildWebhookUrl };
