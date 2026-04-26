const express = require('express');
const router  = express.Router();
const { getAllRiders, getMyRider, getRiderById, createRider, updateRider, deleteRider } = require('../controllers/ridersController');
const { requireAuth, requireAdmin } = require('../middleware/requireAuth');

router.get('/',    requireAdmin, getAllRiders);
router.get('/me',  requireAuth,  getMyRider);
router.get('/:id', requireAuth,  getRiderById);
router.post('/',   requireAdmin, createRider);
router.put('/:id', requireAuth,  updateRider);
router.delete('/:id', requireAdmin, deleteRider);

module.exports = router;
