const express = require('express');
const c = require('../controllers/insights.controller');
const { authenticateToken, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/jobs.csv', authenticateToken, authorize('WORKSHOP_MANAGER', 'SERVICE_ADVISOR', 'AUDITOR'), c.exportJobs);
router.get('/stock.csv', authenticateToken, authorize('WORKSHOP_MANAGER', 'STOREKEEPER', 'PROCUREMENT', 'AUDITOR'), c.exportStock);
router.get('/attendance.csv', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR', 'MENTOR', 'AUDITOR'), c.exportAttendance);

module.exports = router;
