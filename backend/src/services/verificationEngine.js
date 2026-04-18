const Grievance = require('../models/Grievance');
const VerificationLog = require('../models/VerificationLog');
const DepartmentScore = require('../models/DepartmentScore');
const Evidence = require('../models/Evidence');
const { haversineDistance } = require('../utils/haversine');
const { GRIEVANCE_STATUS, CITIZEN_RESPONSE, GPS_THRESHOLD_METERS } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * Core decision engine: evaluates all verification data and determines final status.
 * This is INDEPENDENT of the resolving department — no self-certification.
 */
async function evaluateVerification(grievanceId) {
  const grievance = await Grievance.findById(grievanceId);
  if (!grievance) throw new Error(`Grievance ${grievanceId} not found`);

  const verLog = await VerificationLog.findOne({ grievance: grievanceId }).sort({ createdAt: -1 });
  if (!verLog) throw new Error(`No verification log for grievance ${grievanceId}`);

  const evidence = await Evidence.findOne({ grievance: grievanceId }).sort({ createdAt: -1 });

  let finalStatus = GRIEVANCE_STATUS.REOPENED;
  let reason = '';

  // ── Decision Logic ─────────────────────────────
  if (verLog.citizenResponse === CITIZEN_RESPONSE.DISPUTED) {
    reason = 'Citizen disputed the resolution via IVR (pressed 2).';
  } else if (verLog.citizenResponse === CITIZEN_RESPONSE.NO_RESPONSE) {
    reason = 'Citizen did not respond to IVR call. No confirmation received.';
  } else if (verLog.citizenResponse !== CITIZEN_RESPONSE.CONFIRMED) {
    reason = 'Citizen confirmation still pending.';
  } else if (!evidence) {
    reason = 'No evidence uploaded by field officer.';
  } else {
    // Citizen confirmed — now check evidence
    const grvLat = grievance.location.coordinates[1];
    const grvLon = grievance.location.coordinates[0];
    const distance = haversineDistance(grvLat, grvLon, evidence.latitude, evidence.longitude);

    evidence.distanceFromGrievance = Math.round(distance);
    evidence.isGpsValid = distance <= GPS_THRESHOLD_METERS;
    await evidence.save();

    if (!evidence.isGpsValid) {
      reason = `GPS mismatch: officer was ${Math.round(distance)}m away (threshold: ${GPS_THRESHOLD_METERS}m).`;
    } else if (!evidence.isImageValid) {
      reason = 'Uploaded image failed validation (possibly unrelated or duplicate).';
    } else {
      // ALL checks passed
      finalStatus = GRIEVANCE_STATUS.CLOSED;
      reason = 'All verification checks passed: citizen confirmed + valid evidence + GPS match.';
    }
  }

  // ── Update Records ─────────────────────────────
  verLog.finalStatus = finalStatus;
  verLog.decisionReason = reason;
  verLog.evidenceUploaded = !!evidence;
  verLog.evidenceGpsValid = evidence ? evidence.isGpsValid : false;
  await verLog.save();

  grievance.status = finalStatus;
  if (finalStatus === GRIEVANCE_STATUS.CLOSED) {
    grievance.closedAt = new Date();
  } else {
    grievance.reopenedAt = new Date();
    grievance.reopenCount = (grievance.reopenCount || 0) + 1;
  }
  await grievance.save();

  // ── Update Department Score ────────────────────
  await updateDepartmentScore(grievance.department, finalStatus);

  logger.info(`Verification complete for grievance ${grievanceId}: ${finalStatus} — ${reason}`);
  return { finalStatus, reason };
}

/**
 * Update department quality score — public-facing, visible to Collector.
 */
async function updateDepartmentScore(departmentId, finalStatus) {
  let score = await DepartmentScore.findOne({ department: departmentId });
  if (!score) {
    score = new DepartmentScore({ department: departmentId });
  }

  score.totalGrievances += 1;
  if (finalStatus === GRIEVANCE_STATUS.CLOSED) {
    score.successfulVerifications += 1;
  } else {
    score.failedVerifications += 1;
  }
  score.pendingVerifications = Math.max(0, (score.pendingVerifications || 0) - 1);
  score.recalculateScore();
  await score.save();

  logger.info(`Department ${departmentId} score updated: ${score.score}%`);
  return score;
}

module.exports = { evaluateVerification, updateDepartmentScore };
