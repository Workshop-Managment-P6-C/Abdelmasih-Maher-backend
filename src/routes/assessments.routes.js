const express = require('express');
const t = require('../controllers/training.controller');
const { authenticateToken, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR', 'MENTOR', 'STUDENT', 'AUDITOR'), t.getAssessments);
router.post('/', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR', 'MENTOR'), t.createAssessment);
router.patch('/:id/sign', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR'), t.signAssessment);

module.exports = router;
