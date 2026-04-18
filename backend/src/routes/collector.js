const router = require('express').Router();
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { getCollectorDashboard, getFailedVerifications } = require('../services/scoreService');
const VerificationLog = require('../models/VerificationLog');
const Grievance = require('../models/Grievance');

// ── GET /api/collector/dashboard — Aggregated stats for Collector ──
router.get('/dashboard', auth, roleGuard('COLLECTOR'), async (req, res) => {
  try {
    const departments = await getCollectorDashboard();

    // Overall stats
    const totalGrievances = await Grievance.countDocuments();
    const totalOpen = await Grievance.countDocuments({ status: 'OPEN' });
    const totalPending = await Grievance.countDocuments({ status: 'PENDING_VERIFICATION' });
    const totalClosed = await Grievance.countDocuments({ status: 'CLOSED' });
    const totalReopened = await Grievance.countDocuments({ status: 'REOPENED' });

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

// ── GET /api/collector/failed/:departmentId — Drill down into failed verifications ──
router.get('/failed/:departmentId', auth, roleGuard('COLLECTOR'), async (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = await getFailedVerifications(
      req.params.departmentId,
      parseInt(page) || 1,
      parseInt(limit) || 20
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/collector/audit/:grievanceId — Full audit packet ──
router.get('/audit/:grievanceId', auth, roleGuard('COLLECTOR'), async (req, res) => {
  try {
    const grievance = await Grievance.findById(req.params.grievanceId)
      .populate('department', 'name code')
      .populate('complainant', 'name phone')
      .populate('assignedOfficer', 'name phone');

    if (!grievance) return res.status(404).json({ error: 'Grievance not found' });

    const verificationLogs = await VerificationLog.find({ grievance: grievance._id })
      .sort({ createdAt: -1 });

    const Evidence = require('../models/Evidence');
    const evidence = await Evidence.find({ grievance: grievance._id })
      .populate('uploadedBy', 'name username')
      .sort({ createdAt: -1 });

    res.json({
      grievance,
      verificationLogs,
      evidence,
      auditPacket: {
        hasPhoto: evidence.length > 0,
        hasGps: evidence.some(e => e.latitude && e.longitude),
        hasVoiceLog: verificationLogs.some(v => v.ivrCallSid),
        isComplete: evidence.length > 0 && verificationLogs.length > 0 && verificationLogs[0].citizenResponse !== 'PENDING',
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
