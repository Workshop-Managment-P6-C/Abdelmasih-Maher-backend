const express = require('express');
const c = require('../controllers/auth.controller');
const { authenticateToken, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticateToken, authorize('WORKSHOP_MANAGER', 'AUDITOR'), c.getUsers);
router.get('/:id', authenticateToken, authorize('WORKSHOP_MANAGER', 'AUDITOR'), c.getUserById);
router.put('/:id', authenticateToken, authorize('WORKSHOP_MANAGER'), c.updateUser);
router.delete('/:id', authenticateToken, authorize('WORKSHOP_MANAGER'), c.deleteUser);

module.exports = router;
