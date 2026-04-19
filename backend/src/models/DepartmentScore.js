const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const DepartmentScore = sequelize.define('DepartmentScore', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  departmentName: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    field: 'department_name',
  },
  totalGrievances: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_grievances',
  },
  resolvedCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'resolved_count',
  },
  verifiedCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'verified_count',
  },
  reopenedCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'reopened_count',
  },
  avgResolutionHrs: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'avg_resolution_hrs',
  },
  score: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100,
    },
  },
}, {
  tableName: 'department_scores',
  timestamps: false,
  updatedAt: 'updated_at',
  createdAt: false,
});

// Method to recalculate score
DepartmentScore.prototype.recalculateScore = function () {
  const total = this.verifiedCount + this.reopenedCount;
  this.score = total > 0
    ? Math.round((this.verifiedCount / total) * 100 * 10) / 10
    : 0;
  return this.score;
};

module.exports = DepartmentScore;
