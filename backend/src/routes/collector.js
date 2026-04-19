const router = require('express').Router();
const { Grievance, VerificationLog, FieldEvidence, User, Department } = require('../models');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { getCollectorDashboard, getFailedVerifications } = require('../services/scoreService');
const { GRIEVANCE_STATUS } = require('../utils/constants');

router.get('/dashboard', auth, roleGuard('collector'), async (req, res) => {
  try {
    const departments = await getCollectorDashboard();

    const [totalGrievances, totalOpen, totalPending, totalClosed, totalReopened] = await Promise.all([
      Grievance.count(),
      Grievance.count({ where: { status: GRIEVANCE_STATUS.OPEN } }),
      Grievance.count({ where: { status: GRIEVANCE_STATUS.PENDING_VERIFICATION } }),
      Grievance.count({ where: { status: GRIEVANCE_STATUS.CLOSED } }),
      Grievance.count({ where: { status: GRIEVANCE_STATUS.REOPENED } }),
    ]);

    res.json({
      overview: {
        totalGrievances,
        open: totalOpen,
        pendingVerification: totalPending,
        closed: totalClosed,
        reopened: totalReopened,
      },
      departments,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/failed/:departmentId', auth, roleGuard('collector'), async (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = await getFailedVerifications(
      req.params.departmentId,
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 20
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/audit/:grievanceId', auth, roleGuard('collector'), async (req, res) => {
  try {
    const grievance = await Grievance.findByPk(req.params.grievanceId, {
      include: [
        { model: User, as: 'citizen', attributes: ['id', 'name', 'email', 'phone'] },
        { model: User, as: 'assignedOfficer', attributes: ['id', 'name', 'email', 'phone'] },
      ],
    });

    if (!grievance) {
      return res.status(404).json({ error: 'Grievance not found' });
    }

    const verificationLogs = await VerificationLog.findAll({
      where: { grievanceId: grievance.id },
      order: [['created_at', 'DESC']],
    });

    const evidence = await FieldEvidence.findAll({
      where: { grievanceId: grievance.id },
      order: [['timestamp', 'DESC']],
    });

    const department = grievance.department
      ? await Department.findOne({ where: { name: grievance.department } })
      : null;

    res.json({
      grievance: {
        ...grievance.toJSON(),
        departmentMeta: department,
      },
      verificationLogs,
      evidence,
      auditPacket: {
        hasPhoto: evidence.length > 0,
        hasGps: evidence.some((item) => item.lat && item.lng),
        hasVoiceLog: verificationLogs.some((item) => item.ivrResult),
        isComplete: evidence.length > 0 && verificationLogs.some((item) => item.status !== 'pending'),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
