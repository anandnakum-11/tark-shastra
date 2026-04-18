const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Department = sequelize.define('Department', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  code: {
    type: DataTypes.STRING,
    unique: true,
  },
  contactEmail: {
    type: DataTypes.STRING,
    field: 'contact_email',
  },
  contactPhone: {
    type: DataTypes.STRING,
    field: 'contact_phone',
  },
  district: {
    type: DataTypes.STRING,
    defaultValue: 'Ahmedabad',
  },
}, {
  tableName: 'departments',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Department;
