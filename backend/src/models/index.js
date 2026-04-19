const User = require('./User');
const Grievance = require('./Grievance');
const FieldEvidence = require('./Evidence');
const VerificationLog = require('./VerificationLog');
const DepartmentScore = require('./DepartmentScore');
const Department = require('./Department');

// Define associations
Grievance.belongsTo(User, { as: 'citizen', foreignKey: 'citizenId' });
Grievance.belongsTo(User, { as: 'assignedOfficer', foreignKey: 'assignedOfficerId' });

FieldEvidence.belongsTo(Grievance, { foreignKey: 'grievanceId' });
FieldEvidence.belongsTo(User, { foreignKey: 'officerId' });

VerificationLog.belongsTo(Grievance, { foreignKey: 'grievanceId' });
VerificationLog.belongsTo(FieldEvidence, { foreignKey: 'evidenceId' });

// Reverse associations
User.hasMany(Grievance, { foreignKey: 'citizenId' });
User.hasMany(FieldEvidence, { foreignKey: 'officerId' });
Grievance.hasMany(FieldEvidence, { foreignKey: 'grievanceId' });
Grievance.hasMany(VerificationLog, { foreignKey: 'grievanceId' });

module.exports = {
  User,
  Grievance,
  FieldEvidence,
  VerificationLog,
  DepartmentScore,
  Department,
};
