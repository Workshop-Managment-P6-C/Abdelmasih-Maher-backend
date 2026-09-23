const express = require('express');
const t = require('../controllers/training.controller');
const { authenticateToken, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR', 'MENTOR', 'STUDENT'), t.getEnrollments);
router.post('/', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR', 'MENTOR', 'STUDENT'), t.enrollStudent);
router.delete('/:id', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR'), t.deleteEnrollment);

module.exports = router;
