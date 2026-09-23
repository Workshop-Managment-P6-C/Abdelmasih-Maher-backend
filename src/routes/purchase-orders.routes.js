const express = require('express');
const c = require('../controllers/purchasing.controller');
const { authenticateToken, authorize, ROLES } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticateToken, authorize(...ROLES.INVENTORY), c.getPOs);
router.post('/', authenticateToken, authorize(...ROLES.PROCUREMENT), c.createPO);
router.get('/:id', authenticateToken, authorize(...ROLES.INVENTORY), c.getPOById);
router.post('/:id/submit', authenticateToken, authorize(...ROLES.PROCUREMENT), c.submitPO);
router.post('/:id/approve', authenticateToken, authorize('WORKSHOP_MANAGER'), c.approvePO);
router.post('/:id/receive', authenticateToken, authorize('WORKSHOP_MANAGER', 'STOREKEEPER'), c.receivePO);

module.exports = router;
