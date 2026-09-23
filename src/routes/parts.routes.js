const express = require('express');
const c = require('../controllers/inventory.controller');
const { authenticateToken, authorize, ROLES } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticateToken, authorize(...ROLES.INVENTORY), c.getParts);
router.post('/', authenticateToken, authorize('WORKSHOP_MANAGER', 'STOREKEEPER'), c.createPart);
router.get('/:id', authenticateToken, authorize(...ROLES.INVENTORY), c.getPartById);
router.put('/:id', authenticateToken, authorize('WORKSHOP_MANAGER', 'STOREKEEPER'), c.updatePart);

module.exports = router;
