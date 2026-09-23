const express = require('express');
const c = require('../controllers/sessions.controller');
const { authenticateToken, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR', 'MENTOR', 'STUDENT'), c.getSessions);
router.post('/', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR'), c.createSession);
router.get('/:id', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR', 'MENTOR', 'STUDENT'), c.getSessionById);
router.patch('/:id/status', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR'), c.setSessionStatus);

module.exports = router;
