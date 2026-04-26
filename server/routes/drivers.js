const express = require('express');
const router = express.Router();
const { getAllDrivers, getMyDriver, getDriverById, createDriver, updateDriver, deleteDriver, getDriverStats } = require('../controllers/driversController');
const { requireAuth, requireAdmin, requireDriver } = require('../middleware/requireAuth');

router.get('/stats', requireDriver, getDriverStats);
router.get('/me',    requireDriver, getMyDriver);
router.get('/',      requireAdmin,  getAllDrivers);
router.get('/:id',   requireAuth,   getDriverById);
router.post('/',     requireAdmin,  createDriver);
router.put('/:id',   requireDriver, updateDriver);
router.delete('/:id', requireAdmin, deleteDriver);

module.exports = router;
