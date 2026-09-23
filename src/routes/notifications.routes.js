const express = require('express');
const c = require('../controllers/insights.controller');
const { authenticateToken, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticateToken, c.getNotifications);
router.post('/', authenticateToken, authorize('WORKSHOP_MANAGER', 'SERVICE_ADVISOR', 'TRAINING_SUPERVISOR', 'MENTOR'), c.postNotification);
router.patch('/:id/read', authenticateToken, authorize('WORKSHOP_MANAGER', 'SERVICE_ADVISOR', 'TECHNICIAN', 'QUALITY_CHECKER', 'STOREKEEPER', 'PROCUREMENT', 'TRAINING_SUPERVISOR', 'MENTOR', 'STUDENT', 'FINANCE_VIEWER', 'AUDITOR', 'CUSTOMER'), c.readNotification);

module.exports = router;
