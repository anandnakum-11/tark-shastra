const Grievance = require('../models/Grievance');
const VerificationLog = require('../models/VerificationLog');
const DepartmentScore = require('../models/DepartmentScore');
const Evidence = require('../models/Evidence');
const User = require('../models/User');
const { GRIEVANCE_STATUS, CITIZEN_RESPONSE } = require('../utils/constants');
const { makeIvrCall } = require('../config/twilio');
const logger = require('../utils/logger');

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

  let finalStatus = GRIEVANCE_STATUS.REOPENED;
  let logStatus = 'failed';
  let reason = '';

  if (verLog.ivrResult === CITIZEN_RESPONSE.DISPUTED) {
    reason = 'Citizen disputed the resolution via IVR.';
  } else if (verLog.ivrResult === CITIZEN_RESPONSE.NO_RESPONSE || !verLog.ivrResult) {
    reason = 'Citizen did not confirm the resolution via IVR.';
  } else if (!evidence) {
    reason = 'No field evidence was uploaded.';
  } else if (!evidence.gpsMatch) {
    reason = `Evidence GPS mismatch: ${evidence.gpsDistanceM}m away from the grievance location.`;
  } else if (evidence.verificationStatus !== 'valid') {
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
  grievance.reopenedCount = finalStatus === GRIEVANCE_STATUS.REOPENED
    ? (grievance.reopenedCount || 0) + 1
    : grievance.reopenedCount;
  await grievance.save();

  await updateDepartmentScore(grievance.department, finalStatus);

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

  const phone = grievance.citizen?.phone;
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

  logger.info(`Citizen IVR verification started for grievance ${grievanceId}: ${phone}`);
  return {
    phone,
    callSid: call.sid,
    callStatus: call.status,
    mock: !!call.mock,
  };
}

module.exports = { evaluateVerification, updateDepartmentScore, triggerCitizenVerificationCall };
