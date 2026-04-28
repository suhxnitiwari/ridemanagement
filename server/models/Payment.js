const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  payment_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  ride_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  rider_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  amount: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: false,
    validate: { min: 0 },
  },
  payment_method: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'credit_card',
    validate: {
      isIn: [['credit_card', 'debit_card', 'paypal', 'apple_pay', 'google_pay']],
    },
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'completed',
    validate: {
      isIn: [['pending', 'completed', 'refunded']],
    },
  },
  card_last_four: {
    type: DataTypes.STRING(4),
    allowNull: true,
  },
}, {
  tableName: 'payments',
  underscored: true,
});

module.exports = Payment;
