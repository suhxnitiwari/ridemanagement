const express = require('express');
const router = express.Router();
const { getAllDrivers, getMyDriver, getDriverById, createDriver, updateDriver, deleteDriver, getDriverStats, setMyAvailability } = require('../controllers/driversController');
const { requireAuth, requireAdmin, requireDriver } = require('../middleware/requireAuth');

router.get('/stats', requireAdmin,  getDriverStats);   // every driver's numbers: admins only
router.get('/me',    requireDriver, getMyDriver);
router.patch('/me/availability', requireDriver, setMyAvailability);
router.get('/',      requireAdmin,  getAllDrivers);
router.get('/:id',   requireAuth,   getDriverById);
router.post('/',     requireAdmin,  createDriver);
router.put('/:id',   requireDriver, updateDriver);
router.delete('/:id', requireAdmin, deleteDriver);

module.exports = router;
