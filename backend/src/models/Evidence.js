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
}, {
  tableName: 'field_evidence',
  timestamps: false,
  createdAt: 'timestamp',
  updatedAt: false,
});

module.exports = FieldEvidence;
