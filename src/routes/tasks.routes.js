const express = require('express');
const t = require('../controllers/training.controller');
const { authenticateToken, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', t.getTasks);
router.post('/', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR'), t.createTask);
router.get('/:id', t.getTaskById);
router.put('/:id', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR'), t.updateTask);
router.delete('/:id', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR'), t.deleteTask);

module.exports = router;
