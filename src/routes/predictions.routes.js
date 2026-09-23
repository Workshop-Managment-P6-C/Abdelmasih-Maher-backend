const express = require('express');
const c = require('../controllers/insights.controller');
const { authenticateToken, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR', 'MENTOR', 'AUDITOR'), c.getPredictions);
router.post('/training-risk/:studentId', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR', 'MENTOR'), c.postTrainingRisk);
router.patch('/:id/decision', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR'), c.decidePrediction);

module.exports = router;
