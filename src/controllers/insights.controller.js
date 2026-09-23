const svc = require('../services/insights.service');
const { asyncHandler, sendError } = require('../middlewares/http.middleware');
const { uid } = require('../utils/helpers');

const notFound = (res, e) => res.status(404).json({ error: { code: 'NOT_FOUND', message: `${e} not found`, requestId: `req_${Date.now()}` } });

const jobsDashboard = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.jobsDashboard() }); }
  catch (e) { sendError(res, req, e); }
});
const stockDashboard = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.stockDashboard() }); }
  catch (e) { sendError(res, req, e); }
});
const trainingDashboard = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.trainingDashboard() }); }
  catch (e) { sendError(res, req, e); }
});
const csv = (fn) => asyncHandler(async (req, res) => {
  try {
    res.type('text/csv').status(200).send(await fn());
  } catch (e) { sendError(res, req, e); }
});
const getPredictions = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.listPredictions(req.query) }); }
  catch (e) { sendError(res, req, e); }
});
const postTrainingRisk = asyncHandler(async (req, res) => {
  try { res.status(201).json({ success: true, data: await svc.trainingRisk(req.params.studentId || req.params.id) }); }
  catch (e) { sendError(res, req, e); }
});
const decidePrediction = asyncHandler(async (req, res) => {
  try {
    const r = await svc.decidePrediction(req.params.id, { ...(req.body || {}), decided_by: (req.body || {}).decided_by || uid(req) });
    if (!r) return notFound(res, 'Prediction');
    res.status(200).json({ success: true, data: r });
  } catch (e) { sendError(res, req, e); }
});
const getAttachments = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.listAttachments(req.query.owner_type, req.query.owner_id) }); }
  catch (e) { sendError(res, req, e); }
});
const postAttachment = asyncHandler(async (req, res) => {
  try { res.status(201).json({ success: true, data: await svc.addAttachment({ ...(req.body || {}), uploaded_by: (req.body || {}).uploaded_by || uid(req) }) }); }
  catch (e) { sendError(res, req, e); }
});
const getNotifications = asyncHandler(async (req, res) => {
  try {
    const canReadAny = ['WORKSHOP_MANAGER', 'AUDITOR'].includes(req.user.role);
    const userId = canReadAny ? (req.query.user_id || uid(req)) : uid(req);
    res.status(200).json({ success: true, data: await svc.listNotifications(userId) });
  }
  catch (e) { sendError(res, req, e); }
});
const postNotification = asyncHandler(async (req, res) => {
  try { res.status(201).json({ success: true, data: await svc.createNotification(req.body || {}) }); }
  catch (e) { sendError(res, req, e); }
});
const readNotification = asyncHandler(async (req, res) => {
  try {
    const canReadAny = ['WORKSHOP_MANAGER', 'AUDITOR'].includes(req.user.role);
    const r = await svc.readNotification(req.params.id, canReadAny ? null : uid(req));
    if (!r) return notFound(res, 'Notification');
    res.status(200).json({ success: true, data: r });
  } catch (e) { sendError(res, req, e); }
});

module.exports = {
  jobsDashboard, stockDashboard, trainingDashboard,
  exportJobs: csv(svc.exportJobs), exportStock: csv(svc.exportStock), exportAttendance: csv(svc.exportAttendance),
  getPredictions, postTrainingRisk, decidePrediction,
  getAttachments, postAttachment,
  getNotifications, postNotification, readNotification,
};
