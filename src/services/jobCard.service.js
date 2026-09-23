// Legacy shim kept for backward compatibility.
// New code should use training.service.js (PostgreSQL-backed).
const training = require('./training.service');

const getAllJobCards = async () => [];
const createJobCard = async (data) => data;

module.exports = {
  getAllJobCards,
  createJobCard,
  // Re-export training domain for any legacy importers
  listCourses: training.listCourses,
  createCourse: training.createCourse,
  listTasks: training.listTasks,
  createTask: training.createTask,
};
