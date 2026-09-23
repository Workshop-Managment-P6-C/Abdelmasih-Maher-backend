// Backward-compatible shim: the legacy /api/v1/job-cards/* paths reuse the
// DB-backed training controller so old clients keep working.
const training = require('./training.controller');

module.exports = {
  getJobCards: training.getJobCards,
  createJobCard: training.createJobCard,
  getCourses: training.getCourses,
  getCourseById: training.getCourseById,
  createCourse: training.createCourse,
  updateCourse: training.updateCourse,
  deleteCourse: training.deleteCourse,
  getTasks: training.getTasks,
  getTaskById: training.getTaskById,
  createTask: training.createTask,
  updateTask: training.updateTask,
  deleteTask: training.deleteTask,
  getAssessments: training.getAssessments,
  createAssessment: training.createAssessment,
  signAssessment: training.signAssessment,
  getCompetency: training.getCompetency,
  getEnrollments: training.getEnrollments,
  enrollStudent: training.enrollStudent,
  deleteEnrollment: training.deleteEnrollment,
  getAttendance: training.getAttendance,
  recordAttendance: training.recordAttendance,
  getCertificates: training.getCertificates,
  createCertificate: training.createCertificate,
  verifyCertificate: training.verifyCertificate,
  revokeCertificate: training.revokeCertificate,
  getHallBookings: training.getHallBookings,
  createHallBooking: training.createHallBooking,
};
