const express = require('express');
const w = require('../controllers/workshop.controller');
const legacy = require('../controllers/jobCard.controller');
const { authenticateToken, authorize, ROLES } = require('../middlewares/auth.middleware');

const router = express.Router();

// ---- Legacy training aliases must come before /:id ----
router.get('/courses', authenticateToken, authorize(...ROLES.TRAINING_USERS), legacy.getCourses);
router.post('/courses', authenticateToken, authorize(...ROLES.TRAINING_MANAGERS), legacy.createCourse);
router.get('/courses/:id', authenticateToken, authorize(...ROLES.TRAINING_USERS), legacy.getCourseById);
router.put('/courses/:id', authenticateToken, authorize(...ROLES.TRAINING_MANAGERS), legacy.updateCourse);
router.delete('/courses/:id', authenticateToken, authorize(...ROLES.TRAINING_MANAGERS), legacy.deleteCourse);
router.get('/tasks', authenticateToken, authorize(...ROLES.TRAINING_USERS), legacy.getTasks);
router.post('/tasks', authenticateToken, authorize(...ROLES.TRAINING_MANAGERS), legacy.createTask);
router.get('/tasks/:id', authenticateToken, authorize(...ROLES.TRAINING_USERS), legacy.getTaskById);
router.put('/tasks/:id', authenticateToken, authorize(...ROLES.TRAINING_MANAGERS), legacy.updateTask);
router.delete('/tasks/:id', authenticateToken, authorize(...ROLES.TRAINING_MANAGERS), legacy.deleteTask);
router.get('/assessments', authenticateToken, authorize(...ROLES.TRAINING_USERS), legacy.getAssessments);
router.post('/assessments', authenticateToken, authorize(...ROLES.TRAINING_STAFF), legacy.createAssessment);
router.patch('/assessments/:id/sign', authenticateToken, authorize(...ROLES.TRAINING_MANAGERS), legacy.signAssessment);
router.get('/enrollments', authenticateToken, authorize(...ROLES.TRAINING_USERS), legacy.getEnrollments);
router.post('/enrollments', authenticateToken, authorize(...ROLES.TRAINING_USERS), legacy.enrollStudent);
router.delete('/enrollments/:id', authenticateToken, authorize(...ROLES.TRAINING_MANAGERS), legacy.deleteEnrollment);
router.get('/attendance', authenticateToken, authorize(...ROLES.TRAINING_USERS), legacy.getAttendance);
router.post('/attendance', authenticateToken, authorize(...ROLES.TRAINING_STAFF), legacy.recordAttendance);
router.post('/certificates', authenticateToken, authorize(...ROLES.TRAINING_MANAGERS), legacy.createCertificate);
router.get('/certificates/user/:id', authenticateToken, authorize(...ROLES.TRAINING_USERS), legacy.getCertificates);
router.get('/certificates/verify/:token', legacy.verifyCertificate);
router.get('/halls/bookings', authenticateToken, authorize(...ROLES.TRAINING_STAFF), legacy.getHallBookings);
router.post('/halls/bookings', authenticateToken, authorize(...ROLES.TRAINING_STAFF), legacy.createHallBooking);

// ---- Real job-card endpoints (WST-FR-04/05/06) ----
router.get('/', authenticateToken, authorize(...ROLES.WORKSHOP), w.getJobCards);
router.post('/', authenticateToken, authorize(...ROLES.JOB_COORDINATORS), w.createJobCard);
router.get('/:id', authenticateToken, authorize(...ROLES.WORKSHOP), w.getJobCardById);
router.put('/:id', authenticateToken, authorize(...ROLES.JOB_COORDINATORS), w.updateJobCard);
router.patch('/:id/stage', authenticateToken, authorize(...ROLES.JOB_EXECUTION), w.transitionStage);
router.get('/:id/stages', authenticateToken, authorize(...ROLES.WORKSHOP), w.getJobStages);
router.get('/:id/work-items', authenticateToken, authorize(...ROLES.WORKSHOP), w.getWorkItems);
router.post('/:id/work-items', authenticateToken, authorize(...ROLES.JOB_COORDINATORS), w.createWorkItem);
router.get('/:id/labor', authenticateToken, authorize(...ROLES.WORKSHOP), w.getLabor);
router.post('/:id/labor', authenticateToken, authorize(...ROLES.TECHNICIANS), w.logLabor);

module.exports = router;
