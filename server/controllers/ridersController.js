const { Rider } = require('../models');
const { Op } = require('sequelize');
const { clerkClient } = require('@clerk/express');

// GET /api/riders
const getAllRiders = async (req, res) => {
  try {
    const { search } = req.query;
    const where = search
      ? {
          [Op.or]: [
            { first_name: { [Op.iLike]: `%${search}%` } },
            { last_name: { [Op.iLike]: `%${search}%` } },
            { email: { [Op.iLike]: `%${search}%` } },
          ],
        }
      : {};

    where.active = true;
    const riders = await Rider.findAll({
      where,
      order: [['created_at', 'DESC']],
    });
    res.json({ success: true, data: riders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/riders/me
const getMyRider = async (req, res) => {
  try {
    const { userId } = req.auth;
    let rider = await Rider.findOne({ where: { clerk_user_id: userId } });
    if (!rider) {
      const clerkUser = await clerkClient.users.getUser(userId);
      const email = clerkUser.emailAddresses?.[0]?.emailAddress;
      if (email) rider = await Rider.findOne({ where: { email } });
      if (rider) await rider.update({ clerk_user_id: userId });
    }
    if (!rider) {
      return res.status(404).json({ success: false, message: 'Rider profile not found' });
    }
    res.json({ success: true, data: rider });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/riders/:id
const getRiderById = async (req, res) => {
  try {
    const rider = await Rider.findByPk(req.params.id);
    if (!rider) {
      return res.status(404).json({ success: false, message: 'Rider not found' });
    }
    res.json({ success: true, data: rider });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/riders
const createRider = async (req, res) => {
  try {
    const { first_name, last_name, email, phone_number, default_payment_method, rating } = req.body;

    if (!first_name || !last_name || !email || !phone_number) {
      return res.status(400).json({
        success: false,
        message: 'first_name, last_name, email, and phone_number are required',
      });
    }

    const rider = await Rider.create({
      first_name,
      last_name,
      email,
      phone_number,
      default_payment_method: default_payment_method || 'credit_card',
      rating: rating || 5.00,
    });

    res.status(201).json({ success: true, data: rider });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/riders/:id
const updateRider = async (req, res) => {
  try {
    const rider = await Rider.findByPk(req.params.id);
    if (!rider) {
      return res.status(404).json({ success: false, message: 'Rider not found' });
    }

    const { first_name, last_name, email, phone_number, default_payment_method, rating } = req.body;

    await rider.update({
      first_name: first_name ?? rider.first_name,
      last_name: last_name ?? rider.last_name,
      email: email ?? rider.email,
      phone_number: phone_number ?? rider.phone_number,
      default_payment_method: default_payment_method ?? rider.default_payment_method,
      rating: rating ?? rider.rating,
    });

    res.json({ success: true, data: rider });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/riders/:id — soft delete (sets active = false)
const deleteRider = async (req, res) => {
  try {
    const rider = await Rider.findByPk(req.params.id);
    if (!rider) {
      return res.status(404).json({ success: false, message: 'Rider not found' });
    }
    await rider.update({ active: false });
    res.json({ success: true, message: `Rider ${req.params.id} deactivated` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAllRiders, getMyRider, getRiderById, createRider, updateRider, deleteRider };
