const router = require('express').Router();
const { Grievance, VerificationLog } = require('../models');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const logger = require('../utils/logger');

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

    grievance.status = 'verification_pending';
    grievance.resolvedAt = new Date();
    await grievance.save();

    const verificationLog = await VerificationLog.create({
      grievanceId: grievance.id,
      status: 'pending',
    });

    logger.info(`Grievance ${grievance.id} marked verification_pending by ${req.user.name}`);
    res.status(202).json({ message: 'Marked pending verification', grievance, verificationLog });
  } catch (err) {
    logger.error(`Resolve action error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
