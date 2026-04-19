const router = require('express').Router();
const { Grievance, VerificationLog } = require('../models');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { GRIEVANCE_STATUS } = require('../utils/constants');
const { triggerCitizenVerificationCall } = require('../services/verificationEngine');
const logger = require('../utils/logger');

const RESOLVABLE_STATUSES = new Set([
  GRIEVANCE_STATUS.OPEN,
  GRIEVANCE_STATUS.IN_PROGRESS,
  GRIEVANCE_STATUS.REOPENED,
  GRIEVANCE_STATUS.RESOLVED,
]);

router.post('/grievances/:id/assign-officer', auth, roleGuard('department_officer', 'collector'), async (req, res) => {
  try {
    const { officerId } = req.body;
    const grievance = await Grievance.findByPk(req.params.id);
    if (!grievance) {
      return res.status(404).json({ error: 'Grievance not found' });
    }

    grievance.assignedOfficerId = officerId;
    await grievance.save();

    logger.info(`Grievance ${grievance.id} assigned to officer ${officerId} by ${req.user.name}`);
    res.json({ message: 'Officer assigned', grievance });
  } catch (err) {
    logger.error(`Assign officer error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/grievances/:id/resolve', auth, roleGuard('department_officer', 'collector'), async (req, res) => {
  try {
    const grievance = await Grievance.findByPk(req.params.id);
    if (!grievance) {
      return res.status(404).json({ error: 'Grievance not found' });
    }
    if (grievance.status === GRIEVANCE_STATUS.PENDING_VERIFICATION) {
      return res.status(409).json({ error: 'Grievance is already pending verification.', status: grievance.status });
    }
    if (grievance.status === GRIEVANCE_STATUS.CLOSED) {
      return res.status(409).json({ error: 'Grievance is already verified.', status: grievance.status });
    }
    if (!RESOLVABLE_STATUSES.has(grievance.status)) {
      return res.status(409).json({
        error: `Grievance cannot be resolved from status "${grievance.status}".`,
        status: grievance.status,
      });
    }

    const previousStatus = grievance.status;
    const previousResolvedAt = grievance.resolvedAt;
    grievance.status = GRIEVANCE_STATUS.PENDING_VERIFICATION;
    grievance.resolvedAt = new Date();
    await grievance.save();

    const verificationLog = await VerificationLog.create({
      grievanceId: grievance.id,
      status: 'pending',
    });

    let ivrCall = null;
    try {
      ivrCall = await triggerCitizenVerificationCall(grievance.id);
    } catch (callErr) {
      grievance.status = previousStatus;
      grievance.resolvedAt = previousResolvedAt;
      await grievance.save();
      verificationLog.status = 'failed';
      verificationLog.reason = `Unable to start citizen IVR call: ${callErr.message}`;
      await verificationLog.save();
      logger.warn(`IVR trigger failed for grievance ${grievance.id}: ${callErr.message}`);
      return res.status(502).json({
        error: verificationLog.reason,
        setupHint: 'For a real call, run ngrok for backend port 5001 and set PUBLIC_BASE_URL=https://your-ngrok-domain. For local-only testing, set MOCK_MODE=true.',
        grievance,
        verificationLog,
      });
    }

    logger.info(`Grievance ${grievance.id} marked verification_pending by ${req.user.name}`);
    res.status(202).json({
      message: ivrCall
        ? 'Citizen IVR confirmation started. If the citizen presses 1, field evidence can proceed.'
        : 'Marked pending verification, but citizen IVR could not be started. Check Twilio configuration and citizen phone number.',
      grievance,
      verificationLog,
      ivrCall,
    });
  } catch (err) {
    logger.error(`Resolve action error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
