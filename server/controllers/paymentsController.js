const Payment = require('../models/Payment');
const Rider   = require('../models/Rider');
const { clerkClient } = require('@clerk/express');

const isAdmin = async (userId) => {
  try {
    const user = await clerkClient.users.getUser(userId);
    const role = user.publicMetadata?.role;
    return role === 'admin' || role === 'manager' || role === 'driver';
  } catch {
    return false;
  }
};

// GET /api/payments
const getAllPayments = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const admin  = await isAdmin(userId);

    const where = {};

    if (!admin) {
      // Row-level: only show payments belonging to this Clerk user's rider record
      let rider = await Rider.findOne({ where: { clerk_user_id: userId } });

      // Email fallback: auto-link if clerk_user_id not set yet (same pattern as /riders/me)
      if (!rider) {
        try {
          const clerkUser = await clerkClient.users.getUser(userId);
          const email = clerkUser.emailAddresses?.[0]?.emailAddress;
          if (email) {
            rider = await Rider.findOne({ where: { email } });
            if (rider) await rider.update({ clerk_user_id: userId });
          }
        } catch {}
      }

      if (!rider) return res.json({ success: true, data: [] });
      where.rider_id = rider.rider_id;
    }

    const payments = await Payment.findAll({ where, order: [['created_at', 'DESC']] });
    res.json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/payments/:id
const getPaymentById = async (req, res) => {
  try {
    const userId  = req.auth?.userId;
    const admin   = await isAdmin(userId);
    const payment = await Payment.findByPk(req.params.id);

    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });

    if (!admin) {
      const rider = await Rider.findOne({ where: { clerk_user_id: userId } });
      if (!rider || payment.rider_id !== rider.rider_id) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    res.json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/payments
const createPayment = async (req, res) => {
  try {
    const { ride_id, amount, payment_method, status, card_last_four } = req.body;
    if (!ride_id || amount === undefined) {
      return res.status(400).json({ success: false, message: 'ride_id and amount are required' });
    }

    // Auto-resolve rider_id from the authenticated user so payments always link correctly
    let { rider_id } = req.body;
    if (!rider_id) {
      const userId = req.auth?.userId;
      let rider = await Rider.findOne({ where: { clerk_user_id: userId } });
      if (!rider) {
        try {
          const clerkUser = await clerkClient.users.getUser(userId);
          const email = clerkUser.emailAddresses?.[0]?.emailAddress;
          if (email) {
            rider = await Rider.findOne({ where: { email } });
            if (rider) await rider.update({ clerk_user_id: userId });
          }
        } catch {}
      }
      rider_id = rider?.rider_id ?? null;
    }

    const payment = await Payment.create({ ride_id, rider_id, amount, payment_method, status, card_last_four });
    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/payments/:id  (admin only — enforced at route level)
const updatePayment = async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });

    const { ride_id, rider_id, amount, payment_method, status } = req.body;
    await payment.update({
      ride_id:        ride_id        ?? payment.ride_id,
      rider_id:       rider_id       ?? payment.rider_id,
      amount:         amount         ?? payment.amount,
      payment_method: payment_method ?? payment.payment_method,
      status:         status         ?? payment.status,
    });

    res.json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/payments/:id  (admin only — enforced at route level)
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
