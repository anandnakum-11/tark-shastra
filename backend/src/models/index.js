const User = require('./User');
const Grievance = require('./Grievance');
const FieldEvidence = require('./Evidence');
const VerificationLog = require('./VerificationLog');
const DepartmentScore = require('./DepartmentScore');

// Define associations
Grievance.belongsTo(User, { as: 'citizen', foreignKey: 'citizen_id' });
Grievance.belongsTo(User, { as: 'assignedOfficer', foreignKey: 'assigned_officer_id' });

FieldEvidence.belongsTo(Grievance, { foreignKey: 'grievance_id' });
FieldEvidence.belongsTo(User, { foreignKey: 'officer_id' });

VerificationLog.belongsTo(Grievance, { foreignKey: 'grievance_id' });
VerificationLog.belongsTo(FieldEvidence, { foreignKey: 'evidence_id' });

// Reverse associations
User.hasMany(Grievance, { foreignKey: 'citizen_id' });
User.hasMany(FieldEvidence, { foreignKey: 'officer_id' });
Grievance.hasMany(FieldEvidence, { foreignKey: 'grievance_id' });
Grievance.hasMany(VerificationLog, { foreignKey: 'grievance_id' });

module.exports = {
  User,
  Grievance,
  FieldEvidence,
  VerificationLog,
  DepartmentScore,
};
