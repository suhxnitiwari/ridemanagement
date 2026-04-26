const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Driver = sequelize.define('Driver', {
  driver_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  first_name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { notEmpty: true },
  },
  last_name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { notEmpty: true },
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  phone_number: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  license_plate: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  vehicle_model: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'available',
    validate: {
      isIn: [['available', 'on_ride', 'offline', 'inactive']],
    },
  },
  rating: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 5.00,
    validate: { min: 1.0, max: 5.0 },
  },
  clerk_user_id: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
}, {
  tableName: 'drivers',
  underscored: true,
});

module.exports = Driver;
