const express = require('express');
const router  = express.Router();
const { getAllRides, getRideById, createRide, updateRide, updateRideStatus, deleteRide } = require('../controllers/ridesController');
const { requireAuth, requireAdmin, requireDriver } = require('../middleware/requireAuth');

router.get('/',      requireAuth,   getAllRides);
router.get('/:id',   requireAuth,   getRideById);
router.post('/',     requireAuth,   createRide);
router.put('/:id',        requireAuth,   updateRide);
router.patch('/:id/status', requireDriver, updateRideStatus);
router.delete('/:id',     requireAdmin,  deleteRide);

module.exports = router;
