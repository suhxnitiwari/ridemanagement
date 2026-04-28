const { Ride, Rider } = require('../models');
const { clerkClient } = require('@clerk/express');
const { Op } = require('sequelize');

const isAdmin = async (userId) => {
  try {
    const user = await clerkClient.users.getUser(userId);
    const role = user.publicMetadata?.role;
    return role === 'admin' || role === 'manager' || role === 'driver';
  } catch {
    return false;
  }
};

// GET /api/rides
const getAllRides = async (req, res) => {
  try {
    const { search, status, statuses } = req.query;
    const userId = req.auth?.userId;
    const admin  = await isAdmin(userId);

    const where = {};

    if (!admin) {
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
      if (!rider) return res.json({ success: true, data: [] });
      where.rider_id = rider.rider_id;
    }

    if (statuses) where.status = { [Op.in]: statuses.split(',') };
    else if (status && status !== 'all') where.status = status;
    if (search) {
      where[Op.or] = [
        { pickup_location:  { [Op.iLike]: `%${search}%` } },
        { dropoff_location: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const rides = await Ride.findAll({ where, order: [['created_at', 'DESC']] });
    res.json({ success: true, data: rides });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/rides/:id
const getRideById = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const admin  = await isAdmin(userId);
    const ride   = await Ride.findByPk(req.params.id);

    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });

    if (!admin) {
      const rider = await Rider.findOne({ where: { clerk_user_id: userId } });
      if (!rider || ride.rider_id !== rider.rider_id) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    res.json({ success: true, data: ride });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/rides
const createRide = async (req, res) => {
  try {
    const { pickup_location, dropoff_location, status, fare, driver_id } = req.body;
    const userId = req.auth?.userId;

    if (await isAdmin(userId)) {
      return res.status(403).json({ success: false, message: 'Admins cannot create rides' });
    }

    if (!pickup_location || !dropoff_location) {
      return res.status(400).json({ success: false, message: 'pickup_location and dropoff_location are required' });
    }

    // Auto-link rider_id — try clerk_user_id first, fall back to email
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

    const ride = await Ride.create({
      rider_id: rider?.rider_id || null,
      driver_id,
      pickup_location,
      dropoff_location,
      status: status || 'requested',
      fare,
    });

    res.status(201).json({ success: true, data: ride });
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/rides/:id
const updateRide = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const admin  = await isAdmin(userId);
    const ride   = await Ride.findByPk(req.params.id);

    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });

    if (!admin) {
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
      if (!rider || ride.rider_id !== rider.rider_id) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const { rider_id, driver_id, pickup_location, dropoff_location, status, fare } = req.body;
    await ride.update({
      rider_id:         rider_id         ?? ride.rider_id,
      driver_id:        driver_id        ?? ride.driver_id,
      pickup_location:  pickup_location  ?? ride.pickup_location,
      dropoff_location: dropoff_location ?? ride.dropoff_location,
      status:           status           ?? ride.status,
      fare:             fare             ?? ride.fare,
    });

    res.json({ success: true, data: ride });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/rides/:id — soft delete (sets status = 'cancelled')
const deleteRide = async (req, res) => {
  try {
    const ride = await Ride.findByPk(req.params.id);
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
    await ride.update({ status: 'cancelled' });
    res.json({ success: true, message: `Ride ${req.params.id} cancelled` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/rides/:id/status — status-only update
const updateRideStatus = async (req, res) => {
  const VALID = ['requested','accepted','en_route','in_progress','completed','cancelled'];
  const { status } = req.body;
  if (!status || !VALID.includes(status)) {
    return res.status(400).json({ success: false, message: `status must be one of: ${VALID.join(', ')}` });
  }
  try {
    const ride = await Ride.findByPk(req.params.id);
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
    await ride.update({ status });
    res.json({ success: true, data: ride });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAllRides, getRideById, createRide, updateRide, updateRideStatus, deleteRide };
