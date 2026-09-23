const express = require('express');
const t = require('../controllers/training.controller');
const { authenticateToken, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/verify/:token', t.verifyCertificate);
router.get('/user/:id', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR', 'MENTOR', 'STUDENT'), t.getCertificates);
router.post('/', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR'), t.createCertificate);
router.patch('/:id/revoke', authenticateToken, authorize('WORKSHOP_MANAGER', 'TRAINING_SUPERVISOR'), t.revokeCertificate);

module.exports = router;
