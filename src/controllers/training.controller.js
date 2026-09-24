const svc = require('../services/training.service');
const { asyncHandler, sendError } = require('../middlewares/http.middleware');

const notFound = (res, entity) => res.status(404).json({ error: { code: 'NOT_FOUND', message: `${entity} not found`, requestId: `req_${Date.now()}` } });

// ---------- Courses ----------
const getCourses = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.listCourses() }); }
  catch (e) { sendError(res, req, e); }
});
const getCourseById = asyncHandler(async (req, res) => {
  try {
    const row = await svc.getCourseById(req.params.id);
    if (!row) return notFound(res, 'Course');
    res.status(200).json({ success: true, data: row });
  } catch (e) { sendError(res, req, e); }
});
const createCourse = asyncHandler(async (req, res) => {
  try { res.status(201).json({ success: true, data: await svc.createCourse(req.body || {}) }); }
  catch (e) { sendError(res, req, e); }
});
const updateCourse = asyncHandler(async (req, res) => {
  try {
    const row = await svc.updateCourse(req.params.id, req.body || {});
    if (!row) return notFound(res, 'Course');
    res.status(200).json({ success: true, data: row });
  } catch (e) { sendError(res, req, e); }
});
const deleteCourse = asyncHandler(async (req, res) => {
  try {
    const row = await svc.deleteCourse(req.params.id);
    if (!row) return notFound(res, 'Course');
    res.status(200).json({ success: true, message: 'Course deleted' });
  } catch (e) { sendError(res, req, e); }
});

// ---------- Tasks ----------
const getTasks = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.listTasks(req.query.course_id) }); }
  catch (e) { sendError(res, req, e); }
});
const getTaskById = asyncHandler(async (req, res) => {
  try {
    const row = await svc.getTaskById(req.params.id);
    if (!row) return notFound(res, 'Task');
    res.status(200).json({ success: true, data: row });
  } catch (e) { sendError(res, req, e); }
});
const createTask = asyncHandler(async (req, res) => {
  try { res.status(201).json({ success: true, data: await svc.createTask(req.body || {}) }); }
  catch (e) { sendError(res, req, e); }
});
const updateTask = asyncHandler(async (req, res) => {
  try {
    const row = await svc.updateTask(req.params.id, req.body || {});
    if (!row) return notFound(res, 'Task');
    res.status(200).json({ success: true, data: row });
  } catch (e) { sendError(res, req, e); }
});
const deleteTask = asyncHandler(async (req, res) => {
  try {
    const row = await svc.deleteTask(req.params.id);
    if (!row) return notFound(res, 'Task');
    res.status(200).json({ success: true, message: 'Task deleted' });
  } catch (e) { sendError(res, req, e); }
});

// ---------- Assessments ----------
const getAssessments = asyncHandler(async (req, res) => {
  try {
    const query = { ...req.query };
    if (req.user && req.user.role === 'STUDENT') query.student_id = req.user.userId;
    res.status(200).json({ success: true, data: await svc.listAssessments(query) });
  } catch (e) { sendError(res, req, e); }
});
const createAssessment = asyncHandler(async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.entered_by && req.user) body.entered_by = req.user.userId;
    res.status(201).json({ success: true, data: await svc.createAssessment(body) });
  } catch (e) { sendError(res, req, e); }
});
const signAssessment = asyncHandler(async (req, res) => {
  try {
    const body = { ...req.body };
    const signer = body.signed_by || (req.user ? req.user.userId : null);
    const row = await svc.signAssessment(req.params.id, signer);
    if (!row) return notFound(res, 'Assessment');
    res.status(200).json({ success: true, data: row });
  } catch (e) { sendError(res, req, e); }
});
const getCompetency = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.competencyCoverage(req.params.studentId, req.query.course_id) }); }
  catch (e) { sendError(res, req, e); }
});

// ---------- Enrollments ----------
const getEnrollments = asyncHandler(async (req, res) => {
  try {
    const query = { ...req.query };
    if (req.user && req.user.role === 'STUDENT') query.student_id = req.user.userId;
    res.status(200).json({ success: true, data: await svc.listEnrollments(query) });
  }
  catch (e) { sendError(res, req, e); }
});
const enrollStudent = asyncHandler(async (req, res) => {
  try {
    const body = { ...(req.body || {}) };
    if (req.user && req.user.role === 'STUDENT') body.student_id = req.user.userId;
    res.status(201).json({ success: true, data: await svc.enrollStudent(body) });
  }
  catch (e) { sendError(res, req, e); }
});
const deleteEnrollment = asyncHandler(async (req, res) => {
  try {
    const row = await svc.deleteEnrollment(req.params.id);
    if (!row) return notFound(res, 'Enrollment');
    res.status(200).json({ success: true, message: 'Enrollment deleted' });
  } catch (e) { sendError(res, req, e); }
});

// ---------- Attendance ----------
const getAttendance = asyncHandler(async (req, res) => {
  try {
    const query = { ...req.query };
    if (req.user && req.user.role === 'STUDENT') query.student_id = req.user.userId;
    res.status(200).json({ success: true, data: await svc.listAttendance(query) });
  }
  catch (e) { sendError(res, req, e); }
});
const recordAttendance = asyncHandler(async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.recorded_by && req.user) body.recorded_by = req.user.userId;
    res.status(201).json({ success: true, data: await svc.recordAttendance(body) });
  } catch (e) { sendError(res, req, e); }
});

// ---------- Certificates ----------
const getCertificates = asyncHandler(async (req, res) => {
  try {
    if (req.user && req.user.role === 'STUDENT' && req.params.id !== req.user.userId) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Students can only view their own certificates', requestId: `req_${Date.now()}` } });
    }
    res.status(200).json({ success: true, data: await svc.getCertificatesByStudent(req.params.id) });
  }
  catch (e) { sendError(res, req, e); }
});
const createCertificate = asyncHandler(async (req, res) => {
  try { res.status(201).json({ success: true, data: await svc.createCertificate(req.body || {}) }); }
  catch (e) { sendError(res, req, e); }
});
const verifyCertificate = asyncHandler(async (req, res) => {
  try {
    const row = await svc.verifyCertificate(req.params.token);
    if (!row) return notFound(res, 'Certificate');
    res.status(200).json({ success: true, data: row });
  } catch (e) { sendError(res, req, e); }
});
const revokeCertificate = asyncHandler(async (req, res) => {
  try {
    const row = await svc.revokeCertificate(req.params.id, (req.body || {}).revoked_reason);
    if (!row) return notFound(res, 'Certificate');
    res.status(200).json({ success: true, data: row });
  } catch (e) { sendError(res, req, e); }
});

// ---------- Hall bookings ----------
const getHallBookings = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.listHallBookings(req.query) }); }
  catch (e) { sendError(res, req, e); }
});
const createHallBooking = asyncHandler(async (req, res) => {
  try { res.status(201).json({ success: true, data: await svc.createHallBooking(req.body || {}) }); }
  catch (e) { sendError(res, req, e); }
});
const updateHallBooking = asyncHandler(async (req, res) => {
  try {
    const row = await svc.updateHallBooking(req.params.id, req.body || {});
    if (!row) return notFound(res, 'Hall booking');
    res.status(200).json({ success: true, data: row });
  } catch (e) { sendError(res, req, e); }
});
const deleteHallBooking = asyncHandler(async (req, res) => {
  try {
    const row = await svc.deleteHallBooking(req.params.id);
    if (!row) return notFound(res, 'Hall booking');
    res.status(200).json({ success: true, message: 'Hall booking cancelled' });
  } catch (e) { sendError(res, req, e); }
});

// Legacy job-card placeholders (kept so old /job-cards root never 500s)
const getJobCards = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: [], message: 'Use /api/v1/courses, /api/v1/tasks, /api/v1/assessments' }); }
  catch (e) { sendError(res, req, e); }
});
const createJobCard = asyncHandler(async (req, res) => {
  try { res.status(201).json({ success: true, data: req.body }); }
  catch (e) { sendError(res, req, e); }
});

module.exports = {
  getCourses, getCourseById, createCourse, updateCourse, deleteCourse,
  getTasks, getTaskById, createTask, updateTask, deleteTask,
  getAssessments, createAssessment, signAssessment, getCompetency,
  getEnrollments, enrollStudent, deleteEnrollment,
  getAttendance, recordAttendance,
  getCertificates, createCertificate, verifyCertificate, revokeCertificate,
  getHallBookings, createHallBooking, updateHallBooking, deleteHallBooking,
  getJobCards, createJobCard,
};
