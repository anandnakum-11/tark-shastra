const path = require('path');
const multer = require('multer');
const router = require('express').Router();
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const Evidence = require('../models/Evidence');
const VerificationLog = require('../models/VerificationLog');
const { confirmEvidenceUpload } = require('../services/evidenceService');
const { evaluateVerification, clearEvidenceTimeout } = require('../services/verificationEngine');
const { CITIZEN_RESPONSE } = require('../utils/constants');
const logger = require('../utils/logger');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(file.mimetype)) {
      callback(new Error('Only JPEG and PNG photos are supported.'));
      return;
    }
    callback(null, true);
  },
});

router.post('/upload', auth, roleGuard('field_officer', 'collector'), upload.single('photo'), async (req, res) => {
  try {
    const { grievanceId, latitude, longitude, timestamp } = req.body;
    if (!grievanceId || latitude == null || longitude == null || !timestamp) {
      return res.status(400).json({ error: 'grievanceId, latitude, longitude, timestamp, and photo are required.' });
    }

    const verificationLog = await VerificationLog.findOne({
      where: { grievanceId },
      order: [['created_at', 'DESC']],
    });

    if (!verificationLog || verificationLog.ivrResult !== CITIZEN_RESPONSE.CONFIRMED) {
      return res.status(409).json({
        error: 'Citizen IVR confirmation is required before field evidence can be accepted.',
        ivrResult: verificationLog?.ivrResult || 'pending',
      });
    }

    const result = await confirmEvidenceUpload({
      grievanceId,
      file: req.file,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      timestamp,
      userId: req.user.id,
    });

    try {
      result.finalDecision = await evaluateVerification(grievanceId);
      clearEvidenceTimeout(grievanceId);
    } catch (evaluationErr) {
      logger.warn(`Final verification evaluation after evidence upload failed for grievance ${grievanceId}: ${evaluationErr.message}`);
    }

    res.status(result.isValid ? 201 : 422).json(result);
  } catch (err) {
    logger.error(`Evidence upload error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:grievanceId', auth, async (req, res) => {
  try {
    const evidence = await Evidence.findAll({
      where: { grievanceId: req.params.grievanceId },
      order: [['timestamp', 'DESC']],
    });
    res.json({ evidence });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
