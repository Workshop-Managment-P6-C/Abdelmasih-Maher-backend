const express = require('express');
const c = require('../controllers/billing.controller');
const { authenticateToken, authorize, ROLES } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticateToken, authorize(...ROLES.FINANCE), c.getInvoices);
router.post('/compute', authenticateToken, authorize('WORKSHOP_MANAGER', 'SERVICE_ADVISOR', 'FINANCE_VIEWER'), c.computeInvoice);
router.get('/:id', authenticateToken, authorize(...ROLES.FINANCE), c.getInvoiceById);
router.patch('/:id/status', authenticateToken, authorize('WORKSHOP_MANAGER', 'FINANCE_VIEWER'), c.setInvoiceStatus);

module.exports = router;
