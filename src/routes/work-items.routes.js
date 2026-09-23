const express = require('express');
const w = require('../controllers/workshop.controller');
const { authenticateToken, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.patch('/:id/approve', authenticateToken, authorize('WORKSHOP_MANAGER', 'SERVICE_ADVISOR'), w.approveWorkItem);

module.exports = router;
