const express = require('express');
const w = require('../controllers/workshop.controller');
const { authenticateToken, authorize, ROLES } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticateToken, authorize(...ROLES.WORKSHOP), w.getVehicles);
router.post('/', authenticateToken, authorize(...ROLES.JOB_COORDINATORS), w.createVehicle);
router.get('/:id', authenticateToken, authorize(...ROLES.WORKSHOP), w.getVehicleById);
router.put('/:id', authenticateToken, authorize(...ROLES.JOB_COORDINATORS), w.updateVehicle);
router.delete('/:id', authenticateToken, authorize('WORKSHOP_MANAGER'), w.deleteVehicle);

module.exports = router;
