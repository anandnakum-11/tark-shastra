const router = require('express').Router();
const { Op } = require('sequelize');
const { Grievance, VerificationLog, User } = require('../models');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { GRIEVANCE_STATUS, USER_ROLES } = require('../utils/constants');
const logger = require('../utils/logger');

const VALID_CATEGORIES = new Set(['road', 'water', 'sanitation', 'electricity', 'drainage', 'street_light', 'garbage', 'other']);
const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'critical']);
const RESOLVABLE_STATUSES = new Set([
  GRIEVANCE_STATUS.OPEN,
  GRIEVANCE_STATUS.IN_PROGRESS,
  GRIEVANCE_STATUS.REOPENED,
  GRIEVANCE_STATUS.RESOLVED,
]);

function buildGrievanceCode(grievance) {
  return `SG-${String(grievance.id).split('-')[0].toUpperCase()}`;
}

function formatGrievance(grievance) {
  const data = grievance.toJSON ? grievance.toJSON() : grievance;
  return {
    ...data,
    swagatId: buildGrievanceCode(data),
    citizen: data.citizen || null,
    assignedOfficer: data.assignedOfficer || null,
  };
}

async function getLatestVerificationLog(grievanceId) {
  return VerificationLog.findOne({
    where: { grievanceId },
    order: [['created_at', 'DESC']],
  });
}

async function prepareVerificationRetry(grievanceId) {
  const verificationLog = await getLatestVerificationLog(grievanceId);
  if (!verificationLog) {
    throw new Error('No verification log exists for this pending grievance.');
  }

  verificationLog.status = 'pending';
  verificationLog.ivrResult = null;
  verificationLog.reason = 'Citizen IVR call retried. Awaiting citizen response.';
  verificationLog.evidenceId = null;
  verificationLog.gpsResult = null;
  await verificationLog.save();

  return verificationLog;
}

router.post('/', auth, roleGuard('citizen'), async (req, res) => {
  try {
    const { title, description, category, address, latitude, longitude, department, priority } = req.body;
    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);
    const normalizedCategory = String(category || 'other').trim().toLowerCase();
    const normalizedPriority = String(priority || 'medium').trim().toLowerCase();

    if (!title || !description || !address || latitude == null || longitude == null || !department) {
      return res.status(400).json({
        error: 'Missing required fields: title, description, address, latitude, longitude, department',
      });
    }
    if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
      return res.status(400).json({ error: 'Latitude and longitude must be valid numbers.' });
    }
    if (parsedLatitude < -90 || parsedLatitude > 90 || parsedLongitude < -180 || parsedLongitude > 180) {
      return res.status(400).json({ error: 'Latitude or longitude is outside the valid GPS range.' });
    }
    if (!VALID_CATEGORIES.has(normalizedCategory)) {
      return res.status(400).json({ error: 'Invalid grievance category.' });
    }
    if (!VALID_PRIORITIES.has(normalizedPriority)) {
      return res.status(400).json({ error: 'Invalid grievance priority.' });
    }

    const grievance = await Grievance.create({
      citizenId: req.user.id,
      title: String(title).trim(),
      description: String(description).trim(),
      category: normalizedCategory,
      address: String(address).trim(),
      locationLat: parsedLatitude,
      locationLng: parsedLongitude,
      department: String(department).trim(),
      priority: normalizedPriority,
      status: GRIEVANCE_STATUS.OPEN,
    });

    logger.info(`Grievance created: ${grievance.id} by ${req.user.email}`);
    res.status(201).json({ grievance: formatGrievance(grievance) });
  } catch (err) {
    logger.error(`Create grievance error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const { status, department, page = 1, limit = 20 } = req.query;
    const where = {};

    if (status) where.status = String(status).trim().toLowerCase();
    if (department) where.department = department;

    if (req.user.role === USER_ROLES.CITIZEN) {
      where.citizenId = req.user.id;
    } else if ([USER_ROLES.DEPARTMENT, USER_ROLES.OFFICER].includes(req.user.role) && req.user.department) {
      where.department = req.user.department;
    }

    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 20;

    const { rows, count } = await Grievance.findAndCountAll({
      where,
      include: [
        { model: User, as: 'citizen', attributes: ['id', 'name', 'email', 'phone'] },
        { model: User, as: 'assignedOfficer', attributes: ['id', 'name', 'email', 'phone'] },
      ],
      order: [['updated_at', 'DESC']],
      offset: (pageNumber - 1) * pageSize,
      limit: pageSize,
    });

    res.json({
      grievances: rows.map(formatGrievance),
      total: count,
      page: pageNumber,
      pages: Math.ceil(count / pageSize) || 1,
    });
  } catch (err) {
    logger.error(`List grievances error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const grievance = await Grievance.findByPk(req.params.id, {
      include: [
        { model: User, as: 'citizen', attributes: ['id', 'name', 'email', 'phone'] },
        { model: User, as: 'assignedOfficer', attributes: ['id', 'name', 'email', 'phone'] },
      ],
    });

    if (!grievance) {
      return res.status(404).json({ error: 'Grievance not found' });
    }

    const verificationLog = await getLatestVerificationLog(grievance.id);
    res.json({ grievance: formatGrievance(grievance), verificationLog });
  } catch (err) {
    logger.error(`Get grievance error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/resolve', auth, roleGuard('department_officer', 'collector'), async (req, res) => {
  try {
    const grievance = await Grievance.findByPk(req.params.id, {
      include: [{ model: User, as: 'citizen', attributes: ['id', 'name', 'email', 'phone'] }],
    });

    if (!grievance) {
      return res.status(404).json({ error: 'Grievance not found' });
    }

    if (req.user.role === USER_ROLES.DEPARTMENT && req.user.department && grievance.department !== req.user.department) {
      return res.status(403).json({ error: 'You can only resolve grievances assigned to your department.' });
    }

    if (grievance.status === GRIEVANCE_STATUS.CLOSED) {
      return res.status(409).json({ error: 'Grievance is already verified.', status: grievance.status });
    }

    const isRetry = grievance.status === GRIEVANCE_STATUS.PENDING_VERIFICATION;
    if (!isRetry && !RESOLVABLE_STATUSES.has(grievance.status)) {
      return res.status(409).json({
        error: `Grievance cannot be resolved from status "${grievance.status}".`,
        status: grievance.status,
      });
    }

    const previousStatus = grievance.status;
    const previousResolvedAt = grievance.resolvedAt;
    let verificationLog = null;

    if (isRetry) {
      verificationLog = await prepareVerificationRetry(grievance.id);
    } else {
      grievance.status = GRIEVANCE_STATUS.PENDING_VERIFICATION;
      grievance.resolvedAt = new Date();
      if (!grievance.assignedOfficerId) {
        const fieldOfficer = await User.findOne({
          where: {
            role: USER_ROLES.OFFICER,
            department: grievance.department,
          },
          order: [['created_at', 'ASC']],
        });

        if (fieldOfficer) {
          grievance.assignedOfficerId = fieldOfficer.id;
        }
      }
      await grievance.save();

      verificationLog = await VerificationLog.create({
        grievanceId: grievance.id,
        status: 'pending',
      });
    }

    let ivrCall = null;
    try {
      const { triggerCitizenVerificationCall } = require('../services/verificationEngine');
      ivrCall = await triggerCitizenVerificationCall(grievance.id);
    } catch (callErr) {
      if (isRetry) {
        verificationLog.reason = `Unable to retry citizen IVR call: ${callErr.message}`;
      } else {
        grievance.status = previousStatus;
        grievance.resolvedAt = previousResolvedAt;
        await grievance.save();
        verificationLog.status = 'failed';
        verificationLog.reason = `Unable to start citizen IVR call: ${callErr.message}`;
      }
      await verificationLog.save();
      logger.warn(`IVR trigger failed for grievance ${grievance.id}: ${callErr.message}`);
      return res.status(502).json({
        error: verificationLog.reason,
        setupHint: 'For a real call, run ngrok for backend port 5001 and set PUBLIC_BASE_URL=https://your-ngrok-domain. For local-only testing, set MOCK_MODE=true.',
        status: grievance.status,
        grievance: formatGrievance(grievance),
        verificationLog,
      });
    }

    logger.info(`Grievance ${grievance.id} moved to verification_pending by ${req.user.email}`);
    res.status(202).json({
      status: grievance.status,
      jobId: ivrCall?.callSid || null,
      ivrCall,
      message: ivrCall
        ? isRetry
          ? 'Citizen IVR call retried successfully. Awaiting the latest citizen response.'
          : 'Citizen IVR confirmation started. If the citizen presses 1, the field officer evidence task can proceed.'
        : 'Grievance marked for verification, but citizen IVR could not be started. Please check the citizen phone number or Twilio configuration.',
      grievance: formatGrievance(grievance),
      verificationLog,
      assignedOfficerId: grievance.assignedOfficerId || null,
    });
  } catch (err) {
    logger.error(`Resolve error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/simulate-ivr', auth, async (req, res) => {
  if (process.env.MOCK_MODE !== 'true') {
    return res.status(403).json({ error: 'Manual IVR simulation is disabled in real IVR mode.' });
  }

  try {
    const { digit } = req.body;
    const grievance = await Grievance.findByPk(req.params.id);
    if (!grievance) {
      return res.status(404).json({ error: 'Grievance not found' });
    }

    const verificationLog = await getLatestVerificationLog(grievance.id);
    if (!verificationLog) {
      return res.status(404).json({ error: 'No verification log found' });
    }

    if (digit === '1') {
      verificationLog.ivrResult = 'resolved';
    } else if (digit === '2') {
      verificationLog.ivrResult = 'not_resolved';
    } else {
      verificationLog.ivrResult = 'no_answer';
    }

    await verificationLog.save();
    try {
      const { evaluateVerification } = require('../services/verificationEngine');
      await evaluateVerification(grievance.id);
    } catch (evaluationError) {
      logger.warn(`Simulated IVR evaluation skipped for grievance ${grievance.id}: ${evaluationError.message}`);
    }

    logger.info(`[SIMULATE] IVR response for grievance ${grievance.id}: ${verificationLog.ivrResult}`);
    const updatedGrievance = await Grievance.findByPk(grievance.id);
    res.json({
      message: `Simulated IVR response: ${verificationLog.ivrResult}`,
      verificationLog,
      status: updatedGrievance?.status,
    });
  } catch (err) {
    logger.error(`Simulate IVR error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/evaluate', auth, async (req, res) => {
  if (process.env.MOCK_MODE !== 'true') {
    return res.status(403).json({ error: 'Manual verification evaluation is disabled in real IVR mode.' });
  }

  try {
    const { evaluateVerification } = require('../services/verificationEngine');
    const result = await evaluateVerification(req.params.id);
    res.json({ result });
  } catch (err) {
    logger.error(`Evaluate grievance error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
