const Grievance = require('../models/Grievance');
const VerificationLog = require('../models/VerificationLog');
const DepartmentScore = require('../models/DepartmentScore');
const Evidence = require('../models/Evidence');
const User = require('../models/User');
const { GRIEVANCE_STATUS, CITIZEN_RESPONSE, EVIDENCE_TIMEOUT_HOURS } = require('../utils/constants');
const { makeIvrCall } = require('../config/twilio');
const logger = require('../utils/logger');

const evidenceTimeouts = new Map();

async function evaluateVerification(grievanceId) {
  const grievance = await Grievance.findByPk(grievanceId);
  if (!grievance) {
    throw new Error(`Grievance ${grievanceId} not found`);
  }

  const verLog = await VerificationLog.findOne({
    where: { grievanceId },
    order: [['created_at', 'DESC']],
  });

  if (!verLog) {
    throw new Error(`No verification log for grievance ${grievanceId}`);
  }

  const evidence = await Evidence.findOne({
    where: { grievanceId },
    order: [['timestamp', 'DESC']],
  });

  const previousStatus = grievance.status;
  let finalStatus = GRIEVANCE_STATUS.PENDING_VERIFICATION;
  let logStatus = 'pending';
  let reason = '';

  if (verLog.ivrResult === CITIZEN_RESPONSE.DISPUTED) {
    finalStatus = GRIEVANCE_STATUS.REOPENED;
    logStatus = 'failed';
    reason = 'Citizen disputed the resolution via IVR.';
  } else if (verLog.ivrResult === CITIZEN_RESPONSE.NO_RESPONSE || !verLog.ivrResult) {
    if (verLog.ivrResult === CITIZEN_RESPONSE.NO_RESPONSE) {
      finalStatus = GRIEVANCE_STATUS.REOPENED;
      logStatus = 'failed';
      reason = 'Citizen did not respond to the IVR confirmation. Complaint reopened automatically.';
    } else {
      reason = 'Waiting for citizen IVR confirmation before field evidence verification.';
    }
  } else if (!evidence) {
    reason = 'Citizen confirmed the resolution. Waiting for field officer photo evidence and GPS verification.';
  } else if (!evidence.gpsMatch) {
    finalStatus = GRIEVANCE_STATUS.REOPENED;
    logStatus = 'failed';
    reason = `Evidence GPS mismatch: ${evidence.gpsDistanceM}m away from the grievance location.`;
  } else if (evidence.verificationStatus !== 'valid') {
    finalStatus = GRIEVANCE_STATUS.REOPENED;
    logStatus = 'failed';
    reason = evidence.verificationReason || 'Evidence failed photo authenticity checks.';
  } else {
    finalStatus = GRIEVANCE_STATUS.CLOSED;
    logStatus = 'verified';
    reason = 'Citizen confirmed the resolution and field evidence passed photo and GPS validation.';
  }

  verLog.status = logStatus;
  verLog.reason = reason;
  verLog.gpsResult = evidence ? evidence.gpsMatch : false;
  verLog.evidenceId = evidence?.id || null;
  await verLog.save();

  grievance.status = finalStatus;
  grievance.reopenedCount = finalStatus === GRIEVANCE_STATUS.REOPENED && previousStatus !== GRIEVANCE_STATUS.REOPENED
    ? (grievance.reopenedCount || 0) + 1
    : grievance.reopenedCount;
  await grievance.save();

  if (
    [GRIEVANCE_STATUS.CLOSED, GRIEVANCE_STATUS.REOPENED].includes(finalStatus) &&
    previousStatus !== finalStatus
  ) {
    await updateDepartmentScore(grievance.department, finalStatus);
  }

  logger.info(`Verification complete for grievance ${grievanceId}: ${finalStatus} - ${reason}`);
  return { finalStatus, reason };
}

async function updateDepartmentScore(departmentName, finalStatus) {
  let score = await DepartmentScore.findOne({ where: { departmentName } });
  if (!score) {
    score = await DepartmentScore.create({ departmentName });
  }

  score.totalGrievances += 1;
  if (finalStatus === GRIEVANCE_STATUS.CLOSED) {
    score.verifiedCount += 1;
  } else {
    score.reopenedCount += 1;
  }
  score.recalculateScore();
  await score.save();

  logger.info(`Department ${departmentName} score updated: ${score.score}%`);
  return score;
}

async function triggerCitizenVerificationCall(grievanceId) {
  const grievance = await Grievance.findByPk(grievanceId, {
    include: [{ model: User, as: 'citizen', attributes: ['id', 'name', 'phone', 'email'] }],
  });

  if (!grievance) {
    throw new Error(`Grievance ${grievanceId} not found`);
  }

  const phone = process.env.TO_PHONE_NUMBER || grievance.citizen?.phone;
  if (!phone) {
    throw new Error('Citizen phone number is missing. Please update the citizen profile before triggering IVR.');
  }

  const verificationLog = await VerificationLog.findOne({
    where: { grievanceId },
    order: [['created_at', 'DESC']],
  });

  if (!verificationLog) {
    throw new Error(`No verification log for grievance ${grievanceId}`);
  }

  const call = await makeIvrCall(phone, grievanceId);
  verificationLog.reason = `Citizen IVR call initiated to ${phone}. Awaiting citizen response.`;
  await verificationLog.save();

  if (process.env.TO_PHONE_NUMBER) {
    logger.warn(`Using TO_PHONE_NUMBER override for IVR test call instead of citizen phone for grievance ${grievanceId}.`);
  }
  logger.info(`Citizen IVR verification started for grievance ${grievanceId}: ${phone}`);
  return {
    phone,
    callSid: call.sid,
    callStatus: call.status,
    mock: !!call.mock,
  };
}

async function reopenIfEvidenceMissing(grievanceId) {
  const grievance = await Grievance.findByPk(grievanceId);
  if (!grievance || grievance.status !== GRIEVANCE_STATUS.PENDING_VERIFICATION) {
    return null;
  }

  const verLog = await VerificationLog.findOne({
    where: { grievanceId },
    order: [['created_at', 'DESC']],
  });

  if (verLog?.ivrResult !== CITIZEN_RESPONSE.CONFIRMED) {
    return null;
  }

  const evidence = await Evidence.findOne({
    where: { grievanceId },
    order: [['timestamp', 'DESC']],
  });

  if (evidence) {
    return null;
  }

  verLog.status = 'failed';
  verLog.reason = `Field evidence was not uploaded within ${EVIDENCE_TIMEOUT_HOURS} hour(s) after citizen IVR confirmation. Complaint reopened automatically.`;
  verLog.gpsResult = false;
  await verLog.save();

  grievance.status = GRIEVANCE_STATUS.REOPENED;
  grievance.reopenedCount = (grievance.reopenedCount || 0) + 1;
  await grievance.save();
  await updateDepartmentScore(grievance.department, GRIEVANCE_STATUS.REOPENED);

  logger.warn(`Grievance ${grievanceId} reopened due to missing field evidence after IVR confirmation.`);
  return { finalStatus: GRIEVANCE_STATUS.REOPENED, reason: verLog.reason };
}

function scheduleEvidenceTimeout(grievanceId) {
  if (evidenceTimeouts.has(grievanceId)) {
    clearTimeout(evidenceTimeouts.get(grievanceId));
  }

  const timeoutMs = Math.max(1, EVIDENCE_TIMEOUT_HOURS) * 60 * 60 * 1000;
  const timer = setTimeout(async () => {
    evidenceTimeouts.delete(grievanceId);
    try {
      await reopenIfEvidenceMissing(grievanceId);
    } catch (error) {
      logger.error(`Evidence timeout evaluation failed for grievance ${grievanceId}: ${error.message}`);
    }
  }, timeoutMs);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  evidenceTimeouts.set(grievanceId, timer);
  logger.info(`Evidence timeout scheduled for grievance ${grievanceId}: ${EVIDENCE_TIMEOUT_HOURS} hour(s).`);
}

function clearEvidenceTimeout(grievanceId) {
  if (!evidenceTimeouts.has(grievanceId)) {
    return;
  }

  clearTimeout(evidenceTimeouts.get(grievanceId));
  evidenceTimeouts.delete(grievanceId);
}

module.exports = {
  evaluateVerification,
  updateDepartmentScore,
  triggerCitizenVerificationCall,
  scheduleEvidenceTimeout,
  clearEvidenceTimeout,
  reopenIfEvidenceMissing,
};
