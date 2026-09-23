const express = require('express');
const c = require('../controllers/insights.controller');
const { authenticateToken, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticateToken, authorize('WORKSHOP_MANAGER', 'SERVICE_ADVISOR', 'TECHNICIAN', 'QUALITY_CHECKER', 'TRAINING_SUPERVISOR', 'MENTOR', 'AUDITOR'), c.getAttachments);
router.post('/', authenticateToken, authorize('WORKSHOP_MANAGER', 'SERVICE_ADVISOR', 'TECHNICIAN', 'QUALITY_CHECKER', 'TRAINING_SUPERVISOR', 'MENTOR'), c.postAttachment);

module.exports = router;
