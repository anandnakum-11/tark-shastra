const VoiceResponse = require('twilio').twiml.VoiceResponse;
const { getTwilioWebhookBaseUrl } = require('../config/twilio');

const VOICE_OPTIONS = {
  language: 'gu-IN',
  voice: 'Google.gu-IN-Standard-A',
};

function say(twiml, text) {
  twiml.say(VOICE_OPTIONS, text);
}

function getPromptAudioUrl() {
  if (process.env.IVR_AUDIO_URL) {
    return process.env.IVR_AUDIO_URL;
  }

  const baseUrl = getTwilioWebhookBaseUrl();
  return baseUrl ? `${baseUrl}/api/ivr/audio/gj_audio.mp3` : '';
}

function buildWebhookUrl(path) {
  const baseUrl = getTwilioWebhookBaseUrl();
  return baseUrl ? `${baseUrl}${path}` : path;
}

function generateWelcomeTwiml(grievanceId) {
  const twiml = new VoiceResponse();

  const gather = twiml.gather({
    numDigits: 1,
    action: buildWebhookUrl(`/api/ivr/response?grievanceId=${encodeURIComponent(grievanceId)}`),
    method: 'POST',
    timeout: 10,
    language: 'gu-IN',
    actionOnEmptyResult: true,
  });

  const promptAudioUrl = getPromptAudioUrl();
  if (promptAudioUrl) {
    gather.play(promptAudioUrl);
  } else {
    say(
      gather,
      'નમસ્તે. આ સક્ષ્ય એ આઈ ફરિયાદ ચકાસણી સિસ્ટમ તરફથી કોલ છે. જો તમારી ફરિયાદ સંતોષકારક રીતે ઉકેલાઈ ગઈ હોય તો એક દબાવો. જો સમસ્યા હજુ ચાલુ હોય તો બે દબાવો.'
    );
  }

  say(twiml, 'કોઈ જવાબ મળ્યો નથી. ફરિયાદ ફરીથી ખોલવામાં આવશે. આભાર.');

  return twiml.toString();
}

function generateResponseTwiml(digit) {
  const twiml = new VoiceResponse();

  if (digit === '1') {
    say(twiml, 'આભાર. તમારો પ્રતિસાદ નોંધવામાં આવ્યો છે. હવે ફિલ્ડ વેરિફિકેશન પછી ફરિયાદ બંધ કરવામાં આવશે. નમસ્તે.');
  } else if (digit === '2') {
    say(twiml, 'આભાર. તમારો વિવાદ નોંધવામાં આવ્યો છે. ફરિયાદ ફરીથી ખોલવામાં આવશે. નમસ્તે.');
  } else {
    say(twiml, 'અમાન્ય જવાબ મળ્યો છે. ફરિયાદ ફરીથી ખોલવામાં આવશે. નમસ્તે.');
  }

  return twiml.toString();
}

module.exports = { generateWelcomeTwiml, generateResponseTwiml, getPromptAudioUrl, buildWebhookUrl };
