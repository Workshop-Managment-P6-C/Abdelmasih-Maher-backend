const express = require('express');
const c = require('../controllers/inventory.controller');
const { authenticateToken, authorize, ROLES } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/balances', authenticateToken, authorize(...ROLES.INVENTORY), c.getBalances);
router.get('/movements', authenticateToken, authorize(...ROLES.INVENTORY), c.getMovements);
router.post('/movements', authenticateToken, authorize('WORKSHOP_MANAGER', 'STOREKEEPER'), c.createMovement);
router.get('/reorder-suggestions', authenticateToken, authorize(...ROLES.INVENTORY), c.getReorder);

module.exports = router;
