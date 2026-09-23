const express = require('express');
const w = require('../controllers/workshop.controller');
const { authenticateToken, authorize, ROLES } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticateToken, authorize('WORKSHOP_MANAGER', 'SERVICE_ADVISOR', 'AUDITOR'), w.getCustomers);
router.post('/', authenticateToken, authorize(...ROLES.JOB_COORDINATORS), w.createCustomer);
router.get('/:id', authenticateToken, authorize('WORKSHOP_MANAGER', 'SERVICE_ADVISOR', 'AUDITOR'), w.getCustomerById);
router.put('/:id', authenticateToken, authorize(...ROLES.JOB_COORDINATORS), w.updateCustomer);

module.exports = router;
