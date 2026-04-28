const express = require('express');
const router  = express.Router();
const { getAllPayments, getPaymentById, createPayment, updatePayment, deletePayment } = require('../controllers/paymentsController');
const { requireAuth, requireAdmin } = require('../middleware/requireAuth');

router.get('/',    requireAuth, getAllPayments);
router.get('/:id', requireAuth, getPaymentById);
router.post('/',   requireAuth, createPayment);
router.put('/:id', requireAdmin, updatePayment);
router.delete('/:id', requireAdmin, deletePayment);

module.exports = router;
