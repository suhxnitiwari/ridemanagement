const express = require('express');
const router  = express.Router();
const { Rider, Driver, Ride } = require('../models');
const { Op } = require('sequelize');

router.get('/', async (_req, res) => {
  try {
    const [totalRides, completedRides, totalRiders, totalDrivers, featuredDriver] = await Promise.all([
      Ride.count(),
      Ride.count({ where: { status: 'completed' } }),
      Rider.count({ where: { active: true } }),
      Driver.count({ where: { status: { [Op.ne]: 'inactive' } } }),
      Driver.findOne({ order: [['rating', 'DESC NULLS LAST']] }),
    ]);

    res.json({
      success: true,
      data: {
        total_rides:      totalRides,
        completed_rides:  completedRides,
        total_riders:     totalRiders,
        total_drivers:    totalDrivers,
        featured_driver:  featuredDriver ? {
          initials:      `${featuredDriver.first_name[0]}${featuredDriver.last_name[0]}`.toUpperCase(),
          name:          `${featuredDriver.first_name} ${featuredDriver.last_name[0]}.`,
          license_plate: featuredDriver.license_plate,
          rating:        featuredDriver.rating ? parseFloat(featuredDriver.rating).toFixed(1) : '5.0',
        } : null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;