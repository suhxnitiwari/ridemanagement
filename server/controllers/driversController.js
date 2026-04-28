const { Driver, Ride } = require('../models');
const { Op } = require('sequelize');
const { clerkClient } = require('@clerk/express');

// GET /api/drivers/me
const getMyDriver = async (req, res) => {
  try {
    const { userId } = req.auth;
    let driver = await Driver.findOne({ where: { clerk_user_id: userId } });
    if (!driver) {
      const clerkUser = await clerkClient.users.getUser(userId);
      const email = clerkUser.emailAddresses?.[0]?.emailAddress;
      if (email) driver = await Driver.findOne({ where: { email } });
      if (driver) await driver.update({ clerk_user_id: userId });
    }
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver profile not found' });
    }
    res.json({ success: true, data: driver });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/drivers
const getAllDrivers = async (req, res) => {
  try {
    const { search } = req.query;
    const where = search
      ? {
          [Op.or]: [
            { first_name:    { [Op.iLike]: `%${search}%` } },
            { last_name:     { [Op.iLike]: `%${search}%` } },
            { email:         { [Op.iLike]: `%${search}%` } },
            { license_plate: { [Op.iLike]: `%${search}%` } },
          ],
        }
      : {};

    where.status = { [Op.ne]: 'inactive' };
    const drivers = await Driver.findAll({ where, order: [['created_at', 'DESC']] });
    res.json({ success: true, data: drivers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/drivers/:id
const getDriverById = async (req, res) => {
  try {
    const driver = await Driver.findByPk(req.params.id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
    res.json({ success: true, data: driver });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/drivers
const createDriver = async (req, res) => {
  try {
    const { first_name, last_name, email, phone_number, license_plate, vehicle_model, status, rating } = req.body;

    if (!first_name || !last_name || !email || !phone_number || !license_plate || !vehicle_model) {
      return res.status(400).json({
        success: false,
        message: 'first_name, last_name, email, phone_number, license_plate, and vehicle_model are required',
      });
    }

    const driver = await Driver.create({ first_name, last_name, email, phone_number, license_plate, vehicle_model, status, rating });
    res.status(201).json({ success: true, data: driver });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, message: 'Email or license plate already in use' });
    }
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/drivers/:id
const updateDriver = async (req, res) => {
  try {
    const driver = await Driver.findByPk(req.params.id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    // Ownership check: only the driver themselves or an admin can update
    const { userId } = req.auth;
    const clerkUser = await clerkClient.users.getUser(userId);
    const role = clerkUser.publicMetadata?.role;
    const isAdmin = role === 'admin' || role === 'manager';
    if (!isAdmin) {
      const self = await Driver.findOne({ where: { clerk_user_id: userId } });
      if (!self || self.driver_id !== driver.driver_id) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const { first_name, last_name, email, phone_number, license_plate, vehicle_model, status, rating } = req.body;

    await driver.update({
      first_name:     first_name     ?? driver.first_name,
      last_name:      last_name      ?? driver.last_name,
      email:          email          ?? driver.email,
      phone_number:   phone_number   ?? driver.phone_number,
      license_plate:  license_plate  ?? driver.license_plate,
      vehicle_model:  vehicle_model  ?? driver.vehicle_model,
      status:         status         ?? driver.status,
      rating:         rating         ?? driver.rating,
    });

    res.json({ success: true, data: driver });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, message: 'Email or license plate already in use' });
    }
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/drivers/:id — soft delete (sets status = 'inactive')
const deleteDriver = async (req, res) => {
  try {
    const driver = await Driver.findByPk(req.params.id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
    await driver.update({ status: 'inactive' });
    res.json({ success: true, message: `Driver ${req.params.id} deactivated` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/drivers/stats
const getDriverStats = async (req, res) => {
  try {
    const [drivers, allRides] = await Promise.all([
      Driver.findAll(),
      Ride.findAll({ attributes: ['driver_id', 'status', 'fare'] }),
    ]);

    const ridesByDriver = {};
    for (const r of allRides) {
      if (!ridesByDriver[r.driver_id]) ridesByDriver[r.driver_id] = [];
      ridesByDriver[r.driver_id].push(r);
    }

    const stats = drivers.map((d) => {
      const rides = ridesByDriver[d.driver_id] || [];
      const completed = rides.filter((r) => r.status === 'completed');
      const revenue = completed.reduce((sum, r) => sum + (parseFloat(r.fare) || 0), 0);
      return {
        driver_id:       d.driver_id,
        name:            `${d.first_name} ${d.last_name}`,
        vehicle:         d.vehicle_model,
        vehicle_color:   d.vehicle_color,
        license_plate:   d.license_plate,
        phone_number:    d.phone_number,
        status:          d.status,
        rating:          d.rating,
        total_rides:     rides.length,
        completed_rides: completed.length,
        total_revenue:   parseFloat(revenue.toFixed(2)),
      };
    });
    stats.sort((a, b) => b.total_revenue - a.total_revenue);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAllDrivers, getMyDriver, getDriverById, createDriver, updateDriver, deleteDriver, getDriverStats };
