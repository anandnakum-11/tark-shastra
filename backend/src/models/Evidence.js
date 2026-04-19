const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const FieldEvidence = sequelize.define('FieldEvidence', {
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
  officerId: {
    type: DataTypes.UUID,
    field: 'officer_id',
    references: {
      model: 'users',
      key: 'id',
    },
  },
  imageUrl: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'image_url',
  },
  photoPath: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'photo_path',
  },
  imageHash: {
    type: DataTypes.STRING(128),
    allowNull: false,
    field: 'image_hash',
  },
  verificationStatus: {
    type: DataTypes.ENUM('valid', 'invalid', 'suspicious'),
    allowNull: false,
    defaultValue: 'invalid',
    field: 'verification_status',
  },
  verificationReason: {
    type: DataTypes.TEXT,
    field: 'verification_reason',
  },
  fileSizeBytes: {
    type: DataTypes.INTEGER,
    field: 'file_size_bytes',
  },
  lat: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false,
  },
  lng: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false,
  },
  gpsMatch: {
    type: DataTypes.BOOLEAN,
    field: 'gps_match',
  },
  gpsDistanceM: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'gps_distance_m',
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  capturedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'captured_at',
  },
  blurScore: {
    type: DataTypes.DECIMAL(12, 4),
    field: 'blur_score',
  },
  brightnessScore: {
    type: DataTypes.DECIMAL(12, 4),
    field: 'brightness_score',
  },
}, {
  tableName: 'field_evidence',
  timestamps: false,
});

module.exports = FieldEvidence;
