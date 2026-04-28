const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Rider = sequelize.define('Rider', {
  rider_id: {
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
  default_payment_method: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'credit_card',
    validate: {
      isIn: [['credit_card', 'debit_card', 'paypal', 'apple_pay', 'google_pay']],
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
  preferred_temp: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null,
    validate: { isIn: [['cool', 'warm', 'any', null]] },
  },
  preferred_music: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null,
    validate: { isIn: [['off', 'low', 'riders_choice', null]] },
  },
  preferred_conversation: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null,
    validate: { isIn: [['quiet', 'chatty', 'any', null]] },
  },
  active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  tableName: 'riders',
  underscored: true,
});

module.exports = Rider;
