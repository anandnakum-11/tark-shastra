const router = require('express').Router();
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const Evidence = require('../models/Evidence');
const { getUploadUrl, confirmEvidenceUpload } = require('../services/evidenceService');
const logger = require('../utils/logger');

// ── GET /api/evidence/upload-url — Generate presigned S3 upload URL ──
router.get('/upload-url', auth, roleGuard('OFFICER'), async (req, res) => {
  try {
    const { grievanceId, fileName, fileType } = req.query;
    if (!grievanceId || !fileName) {
      return res.status(400).json({ error: 'grievanceId and fileName are required.' });
    }

    const result = await getUploadUrl(grievanceId, fileName, fileType || 'image/jpeg');
    res.json(result);
  } catch (err) {
    logger.error(`Upload URL error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/evidence/confirm — Confirm upload + GPS coords ──
router.post('/confirm', auth, roleGuard('OFFICER'), async (req, res) => {
  try {
    const { grievanceId, imageKey, latitude, longitude } = req.body;

    if (!grievanceId || !imageKey || latitude == null || longitude == null) {
      return res.status(400).json({ error: 'grievanceId, imageKey, latitude, and longitude are required.' });
    }

    const result = await confirmEvidenceUpload({
      grievanceId,
      imageKey,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      userId: req.user._id,
    });

    res.status(201).json(result);
  } catch (err) {
    logger.error(`Evidence confirm error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/evidence/:grievanceId — Get evidence for a grievance ──
router.get('/:grievanceId', auth, async (req, res) => {
  try {
    const evidence = await Evidence.find({ grievance: req.params.grievanceId })
      .populate('uploadedBy', 'name username')
      .sort({ createdAt: -1 });
    res.json({ evidence });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
