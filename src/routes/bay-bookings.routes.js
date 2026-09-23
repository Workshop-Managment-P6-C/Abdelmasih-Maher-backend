const express = require('express');
const w = require('../controllers/workshop.controller');
const { authenticateToken, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticateToken, authorize('WORKSHOP_MANAGER', 'SERVICE_ADVISOR', 'TECHNICIAN', 'QUALITY_CHECKER', 'AUDITOR'), w.getBayBookings);
router.post('/', authenticateToken, authorize('WORKSHOP_MANAGER', 'SERVICE_ADVISOR'), w.createBayBooking);

module.exports = router;
