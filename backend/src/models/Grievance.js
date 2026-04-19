const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Grievance = sequelize.define('Grievance', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  citizenId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'citizen_id',
    references: {
      model: 'users',
      key: 'id',
    },
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  category: {
    type: DataTypes.ENUM(
      'road', 'water', 'sanitation', 'electricity',
      'drainage', 'street_light', 'garbage', 'other'
    ),
    defaultValue: 'other',
  },
  status: {
    type: DataTypes.ENUM(
      'open', 'in_progress', 'resolved',
      'verification_pending', 'verified', 'reopened'
    ),
    defaultValue: 'open',
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    defaultValue: 'medium',
  },
  locationLat: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false,
    field: 'location_lat',
  },
  locationLng: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false,
    field: 'location_lng',
  },
  address: {
    type: DataTypes.TEXT,
  },
  department: {
    type: DataTypes.STRING,
  },
  assignedOfficerId: {
    type: DataTypes.UUID,
    field: 'assigned_officer_id',
    references: {
      model: 'users',
      key: 'id',
    },
  },
  resolutionNotes: {
    type: DataTypes.TEXT,
    field: 'resolution_notes',
  },
  resolvedAt: {
    type: DataTypes.DATE,
    field: 'resolved_at',
  },
  reopenedCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'reopened_count',
  },
}, {
  tableName: 'grievances',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Grievance;
