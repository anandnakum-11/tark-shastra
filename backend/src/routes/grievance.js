const router = require('express').Router();
const { Op } = require('sequelize');
const { Grievance, VerificationLog, User } = require('../models');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { GRIEVANCE_STATUS, USER_ROLES } = require('../utils/constants');
const logger = require('../utils/logger');

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

router.post('/', auth, async (req, res) => {
  try {
    const { title, description, category, address, latitude, longitude, department, priority } = req.body;

    if (!title || !description || !address || latitude == null || longitude == null || !department) {
      return res.status(400).json({
        error: 'Missing required fields: title, description, address, latitude, longitude, department',
      });
    }

    const grievance = await Grievance.create({
      citizenId: req.user.id,
      title: String(title).trim(),
      description: String(description).trim(),
      category: String(category || 'other').trim().toLowerCase(),
      address: String(address).trim(),
      locationLat: parseFloat(latitude),
      locationLng: parseFloat(longitude),
      department: String(department).trim(),
      priority: String(priority || 'medium').trim().toLowerCase(),
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

    if (grievance.status === GRIEVANCE_STATUS.PENDING_VERIFICATION) {
      return res.status(409).json({ error: 'Grievance is already pending verification.', status: grievance.status });
    }

    if (grievance.status === GRIEVANCE_STATUS.CLOSED) {
      return res.status(409).json({ error: 'Grievance is already verified.', status: grievance.status });
    }

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

    const verificationLog = await VerificationLog.create({
      grievanceId: grievance.id,
      status: 'pending',
    });

    logger.info(`Grievance ${grievance.id} moved to verification_pending by ${req.user.email}`);
    res.status(202).json({
      status: grievance.status,
      jobId: null,
      message: 'Grievance marked for verification. Field evidence is now required before the citizen IVR call is triggered.',
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
    res.json({ message: `Simulated IVR response: ${verificationLog.ivrResult}`, verificationLog });
  } catch (err) {
    logger.error(`Simulate IVR error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/evaluate', auth, async (req, res) => {
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
