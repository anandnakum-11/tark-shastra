const GRIEVANCE_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  PENDING_VERIFICATION: 'verification_pending',
  CLOSED: 'verified',
  REOPENED: 'reopened',
};

const CITIZEN_RESPONSE = {
  CONFIRMED: 'resolved',
  DISPUTED: 'not_resolved',
  NO_RESPONSE: 'no_answer',
  PENDING: 'pending',
};

const USER_ROLES = {
  CITIZEN: 'citizen',
  OFFICER: 'field_officer',
  DEPARTMENT: 'department_officer',
  COLLECTOR: 'collector',
};

const CATEGORIES = ['road', 'water', 'electricity', 'sanitation', 'drainage', 'street_light', 'garbage', 'other'];

const GPS_THRESHOLD_METERS = parseInt(process.env.GPS_THRESHOLD_METERS || '50', 10);
const EVIDENCE_TIMEOUT_HOURS = parseInt(process.env.EVIDENCE_TIMEOUT_HOURS || '24', 10);

module.exports = {
  GRIEVANCE_STATUS,
  CITIZEN_RESPONSE,
  USER_ROLES,
  CATEGORIES,
  GPS_THRESHOLD_METERS,
  EVIDENCE_TIMEOUT_HOURS,
};
