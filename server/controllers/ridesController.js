const { Ride, Rider, Driver } = require('../models');
const { Op } = require('sequelize');
const { getIdentity } = require('../utils/identity');
const { transition, RideError } = require('../utils/rideLifecycle');

// Every ride comes back with the people on it, so pages don't need extra lookups
const WITH_PEOPLE = [
  { model: Rider,  attributes: ['rider_id', 'first_name', 'last_name', 'rating'] },
  { model: Driver, attributes: ['driver_id', 'first_name', 'last_name', 'vehicle_model', 'vehicle_color', 'license_plate', 'rating'] },
];

const STATUSES = ['requested', 'accepted', 'en_route', 'in_progress', 'completed', 'cancelled'];

const fail = (res, error) => {
  if (error instanceof RideError) return res.status(error.status).json({ success: false, message: error.message });
  if (error.name === 'SequelizeValidationError') return res.status(400).json({ success: false, message: error.errors[0].message });
  return res.status(500).json({ success: false, message: error.message });
};

// Row-level access: which rides this person may see
const visibleTo = ({ role, rider, driver }) => {
  if (role === 'admin') return {};
  if (role === 'driver') {
    if (!driver) return null;
    const mine = { driver_id: driver.driver_id };
    // open requests only show up while the driver is Available
    return driver.status === 'available'
      ? { [Op.or]: [mine, { status: 'requested', driver_id: null }] }
      : mine;
  }
  return rider ? { rider_id: rider.rider_id } : null;
};

// GET /api/rides
const getAllRides = async (req, res) => {
  try {
    const identity = await getIdentity(req);
    const scope = visibleTo(identity);
    if (!scope) return res.json({ success: true, data: [] });

    const { search, status, statuses } = req.query;
    const filters = [scope];
    if (statuses) filters.push({ status: { [Op.in]: statuses.split(',') } });
    else if (status && status !== 'all') filters.push({ status });
    if (search) {
      filters.push({
        [Op.or]: [
          { pickup_location:  { [Op.iLike]: `%${search}%` } },
          { dropoff_location: { [Op.iLike]: `%${search}%` } },
        ],
      });
    }

    const rides = await Ride.findAll({ where: { [Op.and]: filters }, include: WITH_PEOPLE, order: [['created_at', 'DESC']] });
    res.json({ success: true, data: rides });
  } catch (error) {
    fail(res, error);
  }
};

// GET /api/rides/:id
const getRideById = async (req, res) => {
  try {
    const identity = await getIdentity(req);
    const scope = visibleTo(identity);
    const ride = scope && await Ride.findOne({ where: { [Op.and]: [{ ride_id: req.params.id }, scope] }, include: WITH_PEOPLE });
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
    res.json({ success: true, data: ride });
  } catch (error) {
    fail(res, error);
  }
};

// POST /api/rides (riders only; the rider comes from the login, never the request body)
const createRide = async (req, res) => {
  try {
    const { role, rider } = await getIdentity(req);
    if (role === 'admin' || role === 'driver') {
      return res.status(403).json({ success: false, message: 'Only riders can request rides' });
    }
    if (!rider) return res.status(403).json({ success: false, message: 'Finish setting up your rider profile first' });

    const { pickup_location, dropoff_location, fare } = req.body;
    if (!pickup_location || !dropoff_location) {
      return res.status(400).json({ success: false, message: 'pickup_location and dropoff_location are required' });
    }
    const open = await Ride.findOne({ where: { rider_id: rider.rider_id, status: ['requested', 'accepted', 'en_route', 'in_progress'] } });
    if (open) return res.status(409).json({ success: false, message: 'You already have a ride in progress' });

    const ride = await Ride.create({
      rider_id: rider.rider_id,
      pickup_location,
      dropoff_location,
      status: 'requested',
      fare,
    });
    res.status(201).json({ success: true, data: await Ride.findByPk(ride.ride_id, { include: WITH_PEOPLE }) });
  } catch (error) {
    fail(res, error);
  }
};

// PUT /api/rides/:id
// Admins can edit everything, including which driver is assigned.
// Drivers and riders can only move the status forward, through the rules in rideLifecycle.
const updateRide = async (req, res) => {
  try {
    const identity = await getIdentity(req);
    const ride = await Ride.findByPk(req.params.id);
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });

    const { status, driver_id, pickup_location, dropoff_location, fare } = req.body;

    if (identity.role === 'admin') {
      if (driver_id !== undefined) {
        if (driver_id !== null) {
          const driver = await Driver.findByPk(driver_id);
          if (!driver || driver.status === 'inactive') return res.status(400).json({ success: false, message: 'Pick an active driver' });
        }
        ride.driver_id = driver_id;
      }
      if (pickup_location !== undefined) ride.pickup_location = pickup_location;
      if (dropoff_location !== undefined) ride.dropoff_location = dropoff_location;
      if (fare !== undefined) ride.fare = fare;
      await ride.save();
      // an admin can set any status by hand, but completing or cancelling goes through the
      // lifecycle so the payment gets created and the driver is freed up
      if (status && status !== ride.status) {
        if (!STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'Unknown status' });
        if (['completed', 'cancelled'].includes(status) && !['completed', 'cancelled'].includes(ride.status)) {
          await transition(ride, status, identity);
        } else {
          ride.status = status;
          await ride.save();
        }
      }
    } else {
      if (!status) return res.status(400).json({ success: false, message: 'status is required' });
      await transition(ride, status, identity, { waiveFee: req.body.reason === 'safety' });
    }

    res.json({ success: true, data: await Ride.findByPk(ride.ride_id, { include: WITH_PEOPLE }) });
  } catch (error) {
    fail(res, error);
  }
};

// PATCH /api/rides/:id/status
const updateRideStatus = async (req, res) => {
  try {
    const identity = await getIdentity(req);
    const ride = await Ride.findByPk(req.params.id);
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
    if (!STATUSES.includes(req.body.status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${STATUSES.join(', ')}` });
    }
    await transition(ride, req.body.status, identity);
    res.json({ success: true, data: await Ride.findByPk(ride.ride_id, { include: WITH_PEOPLE }) });
  } catch (error) {
    fail(res, error);
  }
};

// DELETE /api/rides/:id (admin) — cancels rather than deletes, so history stays intact
const deleteRide = async (req, res) => {
  try {
    const identity = await getIdentity(req);
    const ride = await Ride.findByPk(req.params.id);
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
    if (!['completed', 'cancelled'].includes(ride.status)) await transition(ride, 'cancelled', identity);
    res.json({ success: true, message: `Ride ${req.params.id} cancelled` });
  } catch (error) {
    fail(res, error);
  }
};

module.exports = { getAllRides, getRideById, createRide, updateRide, updateRideStatus, deleteRide };
