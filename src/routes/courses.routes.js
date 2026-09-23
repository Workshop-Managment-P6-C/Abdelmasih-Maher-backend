const express = require('express');
const t = require('../controllers/training.controller');
const { authenticateToken, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', t.getCourses);
router.post('/', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR'), t.createCourse);
router.get('/:id', t.getCourseById);
router.put('/:id', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR'), t.updateCourse);
router.delete('/:id', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR'), t.deleteCourse);

module.exports = router;
