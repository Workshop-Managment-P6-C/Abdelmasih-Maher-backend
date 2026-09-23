const express = require('express');
const t = require('../controllers/training.controller');
const { authenticateToken, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

// Competency coverage for a student (?course_id= required)
router.get('/:studentId/competency', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR', 'MENTOR', 'STUDENT', 'AUDITOR'), (req, res, next) => {
	if (req.user.role === 'STUDENT' && req.params.studentId !== req.user.userId) {
		return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Students can only view their own competency', requestId: `req_${Date.now()}` } });
	}
	return next();
}, t.getCompetency);

module.exports = router;
