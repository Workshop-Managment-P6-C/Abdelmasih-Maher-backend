const express = require('express');
const c = require('../controllers/insights.controller');
const { authenticateToken, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/jobs', authenticateToken, authorize('WORKSHOP_MANAGER', 'SERVICE_ADVISOR', 'AUDITOR'), c.jobsDashboard);
router.get('/stock', authenticateToken, authorize('WORKSHOP_MANAGER', 'STOREKEEPER', 'PROCUREMENT', 'AUDITOR'), c.stockDashboard);
router.get('/training', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR', 'MENTOR', 'AUDITOR'), c.trainingDashboard);

module.exports = router;
