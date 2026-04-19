const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = require('express').Router();
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const VerificationLog = require('../models/VerificationLog');
const validateTwilio = require('../middleware/validateTwilio');
const { generateWelcomeTwiml, generateResponseTwiml } = require('../services/ivrService');
const { CITIZEN_RESPONSE } = require('../utils/constants');
const { evaluateVerification, scheduleEvidenceTimeout } = require('../services/verificationEngine');
const logger = require('../utils/logger');

const ivrUploadsDir = path.join(__dirname, '../../uploads/ivr');

const audioUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => {
      fs.mkdirSync(ivrUploadsDir, { recursive: true });
      callback(null, ivrUploadsDir);
    },
    filename: (req, file, callback) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.mp3';
      callback(null, `ivr-prompt-${Date.now()}${ext}`);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav'];
    if (!allowedTypes.includes(file.mimetype)) {
      callback(new Error('Only MP3 and WAV IVR prompt audio files are supported.'));
      return;
    }
    callback(null, true);
  },
});

async function getLatestVerificationLog(grievanceId) {
  return VerificationLog.findOne({
    where: { grievanceId },
    order: [['created_at', 'DESC']],
  });
}

router.post('/audio', auth, roleGuard('collector'), audioUpload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Audio file is required.' });
  }

  const baseUrl = String(process.env.BASE_URL || '').replace(/\/$/, '');
  if (!baseUrl) {
    return res.status(500).json({ error: 'BASE_URL is required before uploading IVR audio.' });
  }

  const audioUrl = `${baseUrl}/uploads/ivr/${req.file.filename}`;
  process.env.IVR_AUDIO_URL = audioUrl;
  logger.info(`IVR prompt audio updated by ${req.user.email}: ${audioUrl}`);

  res.status(201).json({
    message: 'IVR prompt audio uploaded successfully.',
    audioUrl,
  });
});

router.get('/audio/gj_audio.mp3', (req, res) => {
  const audioPath = path.join(__dirname, '../../../gj_audio.mp3');
  if (!fs.existsSync(audioPath)) {
    return res.status(404).json({ error: 'Gujarati IVR audio file not found.' });
  }

  res.type('audio/mpeg');
  res.sendFile(audioPath);
});

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

      if (verificationLog.ivrResult === CITIZEN_RESPONSE.CONFIRMED) {
        scheduleEvidenceTimeout(grievanceId);
      }
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

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
