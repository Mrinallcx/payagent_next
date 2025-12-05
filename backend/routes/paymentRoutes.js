const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Create new payment request
router.post('/create', paymentController.createPaymentRequest);

// Get all payment requests (with optional wallet filter)
router.get('/requests', paymentController.getAllPaymentRequests);

// Get single payment request
router.get('/request/:id', paymentController.getPaymentRequest);
console.log('getPaymentRequest');

// Delete payment request
router.delete('/request/:id', paymentController.deletePaymentRequest);

// Verify payment on blockchain
router.post('/verify', paymentController.verifyPayment);

// Process LCX payment (legacy/simulation)
router.post('/lcx-pay', paymentController.processLcxPayment);

module.exports = router;
