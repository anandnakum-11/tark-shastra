const VoiceResponse = require('twilio').twiml.VoiceResponse;

/**
 * Generate TwiML for the IVR welcome prompt in Gujarati.
 */
function generateWelcomeTwiml(grievanceId) {
  const twiml = new VoiceResponse();

  const gather = twiml.gather({
    numDigits: 1,
    action: `/api/ivr/response?grievanceId=${grievanceId}`,
    method: 'POST',
    timeout: 10,
    language: 'gu-IN',
  });

  gather.say({
    language: 'gu-IN',
    voice: 'Google.gu-IN-Standard-A',
  }, `નમસ્તે. આ સાક્ષ્ય એ.આઈ. ગ્રિવન્સ વેરિફિકેશન સિસ્ટમ તરફથી કૉલ છે. ` +
     `તમારી ફરિયાદ ની ચકાસણી માટે, ` +
     `જો સમસ્યા ઉકેલાઈ ગઈ હોય, તો 1 દબાવો. ` +
     `જો સમસ્યા હજુ પણ ચાલુ છે, તો 2 દબાવો.`);

  // If no input, say message and hang up
  twiml.say({
    language: 'gu-IN',
    voice: 'Google.gu-IN-Standard-A',
  }, 'કોઈ ઇનપુટ મળ્યું નથી. ફરિયાદ ફરીથી ખોલવામાં આવશે. આભાર.');

  return twiml.toString();
}

/**
 * Generate TwiML response after user presses a digit.
 */
function generateResponseTwiml(digit) {
  const twiml = new VoiceResponse();

  if (digit === '1') {
    twiml.say({
      language: 'gu-IN',
      voice: 'Google.gu-IN-Standard-A',
    }, 'આભાર. તમારો પ્રતિસાદ નોંધવામાં આવ્યો છે. ફરિયાદ ચકાસણી પૂર્ણ થશે. નમસ્તે.');
  } else if (digit === '2') {
    twiml.say({
      language: 'gu-IN',
      voice: 'Google.gu-IN-Standard-A',
    }, 'આભાર. તમારો વિવાદ નોંધવામાં આવ્યો છે. ફરિયાદ ફરીથી ખોલવામાં આવશે. નમસ્તે.');
  } else {
    twiml.say({
      language: 'gu-IN',
      voice: 'Google.gu-IN-Standard-A',
    }, 'અમાન્ય ઇનપુટ. ફરિયાદ ફરીથી ખોલવામાં આવશે. નમસ્તે.');
  }

  return twiml.toString();
}

module.exports = { generateWelcomeTwiml, generateResponseTwiml };
