const router = require('express').Router();
const Grievance = require('../models/Grievance');
const VerificationLog = require('../models/VerificationLog');
const DepartmentScore = require('../models/DepartmentScore');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { GRIEVANCE_STATUS } = require('../utils/constants');
const logger = require('../utils/logger');

// Lazy-load queue to avoid crash if Redis unavailable
let verificationQueueModule = null;
function getQueue() {
  if (!verificationQueueModule) {
    try {
      verificationQueueModule = require('../queues/verificationQueue');
    } catch (e) {
      logger.warn('Queue module unavailable');
    }
  }
  return verificationQueueModule ? verificationQueueModule.getQueue() : null;
}

// ── POST /api/grievances — Create grievance ──
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, category, address, latitude, longitude, complainantPhone, complainantName, department } = req.body;

    if (!title || !description || !address || latitude == null || longitude == null || !complainantPhone || !department) {
      return res.status(400).json({ error: 'Missing required fields: title, description, address, latitude, longitude, complainantPhone, department' });
    }

    const grievance = await Grievance.create({
      title,
      description,
      category: category || 'OTHER',
      address,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      },
      complainant: req.user._id,
      complainantPhone,
      complainantName: complainantName || req.user.name,
      department,
      status: GRIEVANCE_STATUS.OPEN,
    });

    logger.info(`Grievance created: ${grievance._id} by ${req.user.username}`);
    res.status(201).json({ grievance });
  } catch (err) {
    logger.error(`Create grievance error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/grievances — List grievances ────
router.get('/', auth, async (req, res) => {
  try {
    const { status, department, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (department) filter.department = department;

    // Role-based filtering
    if (req.user.role === 'CITIZEN') {
      filter.complainant = req.user._id;
    } else if (req.user.role === 'DEPARTMENT' && req.user.department) {
      filter.department = req.user.department._id || req.user.department;
    } else if (req.user.role === 'OFFICER' && req.user.department) {
      filter.department = req.user.department._id || req.user.department;
    }

    const total = await Grievance.countDocuments(filter);
    const grievances = await Grievance.find(filter)
      .populate('department', 'name code')
      .populate('complainant', 'name username')
      .populate('assignedOfficer', 'name username')
      .sort({ updatedAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    res.json({
      grievances,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    logger.error(`List grievances error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/grievances/:id — Get single grievance ──
router.get('/:id', auth, async (req, res) => {
  try {
    const grievance = await Grievance.findById(req.params.id)
      .populate('department', 'name code')
      .populate('complainant', 'name username phone')
      .populate('assignedOfficer', 'name username');

    if (!grievance) return res.status(404).json({ error: 'Grievance not found' });

    // Get verification log if exists
    const verificationLog = await VerificationLog.findOne({ grievance: grievance._id })
      .sort({ createdAt: -1 });

    res.json({ grievance, verificationLog });
  } catch (err) {
    logger.error(`Get grievance error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/grievances/:id/resolve — Department resolves ──
// This is the KEY endpoint that triggers the verification workflow
router.post('/:id/resolve', auth, roleGuard('DEPARTMENT'), async (req, res) => {
  try {
    const grievance = await Grievance.findById(req.params.id);
    if (!grievance) return res.status(404).json({ error: 'Grievance not found' });

    // Verify this department owns the grievance
    const userDeptId = (req.user.department?._id || req.user.department)?.toString();
    if (userDeptId && grievance.department.toString() !== userDeptId) {
      return res.status(403).json({ error: 'You can only resolve grievances assigned to your department.' });
    }

    // Prevent re-resolve of already pending/closed
    if (grievance.status === GRIEVANCE_STATUS.PENDING_VERIFICATION) {
      return res.status(409).json({ error: 'Grievance is already pending verification.', status: grievance.status });
    }
    if (grievance.status === GRIEVANCE_STATUS.CLOSED) {
      return res.status(409).json({ error: 'Grievance is already closed.', status: grievance.status });
    }

    // Update status to PENDING_VERIFICATION
    grievance.status = GRIEVANCE_STATUS.PENDING_VERIFICATION;
    grievance.resolvedAt = new Date();
    await grievance.save();

    // Create verification log
    const verLog = await VerificationLog.create({
      grievance: grievance._id,
      citizenResponse: 'PENDING',
      finalStatus: 'PENDING',
    });

    // Update department pending count
    let deptScore = await DepartmentScore.findOne({ department: grievance.department });
    if (!deptScore) {
      deptScore = await DepartmentScore.create({ department: grievance.department });
    }
    deptScore.pendingVerifications = (deptScore.pendingVerifications || 0) + 1;
    await deptScore.save();

    // Enqueue verification job
    let jobId = null;
    const queue = getQueue();
    if (queue) {
      try {
        const job = await queue.add('verify_grievance', {
          grievanceId: grievance._id.toString(),
          complainantPhone: grievance.complainantPhone,
        }, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        });
        jobId = job.id;
        grievance.verificationJobId = jobId;
        await grievance.save();
        logger.info(`Verification job enqueued: ${jobId} for grievance ${grievance._id}`);
      } catch (qErr) {
        logger.warn(`Queue error (will process directly): ${qErr.message}`);
        // Fallback: trigger mock IVR directly
        const { makeIvrCall } = require('../config/twilio');
        await makeIvrCall(grievance.complainantPhone, grievance._id.toString());
      }
    } else {
      // No queue available — trigger directly in mock mode
      logger.info(`[DIRECT] Triggering IVR for grievance ${grievance._id}`);
      const { makeIvrCall } = require('../config/twilio');
      await makeIvrCall(grievance.complainantPhone, grievance._id.toString());
    }

    logger.info(`Grievance ${grievance._id} moved to PENDING_VERIFICATION by ${req.user.username}`);
    res.status(202).json({
      status: GRIEVANCE_STATUS.PENDING_VERIFICATION,
      jobId,
      message: 'Grievance marked for verification. IVR call and evidence collection initiated.',
      grievance,
    });
  } catch (err) {
    logger.error(`Resolve error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/grievances/:id/simulate-ivr — Simulate IVR response for testing ──
router.post('/:id/simulate-ivr', auth, async (req, res) => {
  try {
    const { digit } = req.body; // "1" for confirm, "2" for dispute
    const grievance = await Grievance.findById(req.params.id);
    if (!grievance) return res.status(404).json({ error: 'Grievance not found' });

    const verLog = await VerificationLog.findOne({ grievance: grievance._id }).sort({ createdAt: -1 });
    if (!verLog) return res.status(404).json({ error: 'No verification log found' });

    if (digit === '1') {
      verLog.citizenResponse = 'CONFIRMED';
    } else if (digit === '2') {
      verLog.citizenResponse = 'DISPUTED';
    } else {
      verLog.citizenResponse = 'NO_RESPONSE';
    }
    verLog.ivrTimestamp = new Date();
    verLog.ivrCallSid = `SIM_${Date.now()}`;
    await verLog.save();

    logger.info(`[SIMULATE] IVR response for grievance ${grievance._id}: digit=${digit}, response=${verLog.citizenResponse}`);
    res.json({ message: `Simulated IVR response: ${verLog.citizenResponse}`, verificationLog: verLog });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/grievances/:id/evaluate — Trigger verification evaluation ──
router.post('/:id/evaluate', auth, async (req, res) => {
  try {
    const { evaluateVerification } = require('../services/verificationEngine');
    const result = await evaluateVerification(req.params.id);
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
