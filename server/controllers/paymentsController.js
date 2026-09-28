const { Payment, Ride, Rider, Driver } = require('../models');
const { getIdentity } = require('../utils/identity');

// Each payment carries what a receipt needs: the ride, the rider and the driver
const RECEIPT = [
  { model: Rider, attributes: ['rider_id', 'first_name', 'last_name', 'email'] },
  {
    model: Ride,
    attributes: ['ride_id', 'pickup_location', 'dropoff_location', 'status', 'fare', 'driver_id', 'created_at'],
    include: [{ model: Driver, attributes: ['driver_id', 'first_name', 'last_name', 'vehicle_model', 'vehicle_color', 'license_plate'] }],
  },
];

// Row-level access: riders see their own payments, drivers see payments for rides they drove, admins see all
const scopeFor = ({ role, rider, driver }) => {
  if (role === 'admin') return { where: {}, rideWhere: undefined };
  if (role === 'driver') return driver ? { where: {}, rideWhere: { driver_id: driver.driver_id } } : null;
  return rider ? { where: { rider_id: rider.rider_id }, rideWhere: undefined } : null;
};

const withScope = (scope) => RECEIPT.map((inc) =>
  inc.model === Ride && scope.rideWhere ? { ...inc, where: scope.rideWhere, required: true } : inc);

// GET /api/payments (?status= to filter)
const getAllPayments = async (req, res) => {
  try {
    const scope = scopeFor(await getIdentity(req));
    if (!scope) return res.json({ success: true, data: [] });
    const where = { ...scope.where };
    if (req.query.status && req.query.status !== 'all') where.status = req.query.status;
    const payments = await Payment.findAll({ where, include: withScope(scope), order: [['created_at', 'DESC']] });
    res.json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/payments/:id — one receipt
const getPaymentById = async (req, res) => {
  try {
    const scope = scopeFor(await getIdentity(req));
    const payment = scope && await Payment.findOne({ where: { ...scope.where, payment_id: req.params.id }, include: withScope(scope) });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    res.json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/payments (admin only) — normal charges are created automatically when a ride
// completes (see utils/rideLifecycle.js); this is for manual adjustments
const createPayment = async (req, res) => {
  try {
    const { ride_id, amount, payment_method, status, card_last_four, kind } = req.body;
    if (!ride_id || amount === undefined) {
      return res.status(400).json({ success: false, message: 'ride_id and amount are required' });
    }
    const ride = await Ride.findByPk(ride_id);
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
    const payment = await Payment.create({ ride_id, rider_id: ride.rider_id, amount, payment_method, status, card_last_four, kind });
    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/payments/:id (admin only) — e.g. mark a payment failed or refunded
const updatePayment = async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });

    const { amount, payment_method, status } = req.body;
    await payment.update({
      amount:         amount         ?? payment.amount,
      payment_method: payment_method ?? payment.payment_method,
      status:         status         ?? payment.status,
    });

    res.json({ success: true, data: await Payment.findByPk(payment.payment_id, { include: RECEIPT }) });
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/payments/:id (admin only)
const deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    await payment.destroy();
    res.json({ success: true, message: `Payment ${req.params.id} deleted` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAllPayments, getPaymentById, createPayment, updatePayment, deletePayment };
