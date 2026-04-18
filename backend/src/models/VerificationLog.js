const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const VerificationLog = sequelize.define('VerificationLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  grievanceId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'grievance_id',
    references: {
      model: 'grievances',
      key: 'id',
    },
  },
  evidenceId: {
    type: DataTypes.UUID,
    field: 'evidence_id',
    references: {
      model: 'field_evidence',
      key: 'id',
    },
  },
  ivrId: {
    type: DataTypes.UUID,
    field: 'ivr_id',
    references: {
      model: 'ivr_responses',
      key: 'id',
    },
  },
  status: {
    type: DataTypes.ENUM('verified', 'failed', 'pending'),
    defaultValue: 'pending',
  },
  gpsResult: {
    type: DataTypes.BOOLEAN,
    field: 'gps_result',
  },
  aiScore: {
    type: DataTypes.DECIMAL(5, 2),
    field: 'ai_score',
  },
  aiResult: {
    type: DataTypes.ENUM('resolved', 'not_resolved', 'inconclusive'),
    field: 'ai_result',
  },
  ivrResult: {
    type: DataTypes.ENUM('resolved', 'not_resolved', 'no_answer'),
    field: 'ivr_result',
  },
  reason: {
    type: DataTypes.TEXT,
  },
}, {
  tableName: 'verification_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = VerificationLog;
