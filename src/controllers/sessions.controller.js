const svc = require('../services/sessions.service');
const { asyncHandler, sendError } = require('../middlewares/http.middleware');

const notFound = (res, e) => res.status(404).json({ error: { code: 'NOT_FOUND', message: `${e} not found`, requestId: `req_${Date.now()}` } });

const getHalls = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.listHalls() }); }
  catch (e) { sendError(res, req, e); }
});
const createHall = asyncHandler(async (req, res) => {
  try { res.status(201).json({ success: true, data: await svc.createHall(req.body || {}) }); }
  catch (e) { sendError(res, req, e); }
});
const getSessions = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.listSessions(req.query) }); }
  catch (e) { sendError(res, req, e); }
});
const getSessionById = asyncHandler(async (req, res) => {
  try {
    const r = await svc.getSessionById(req.params.id);
    if (!r) return notFound(res, 'Session');
    res.status(200).json({ success: true, data: r });
  } catch (e) { sendError(res, req, e); }
});
const createSession = asyncHandler(async (req, res) => {
  try { res.status(201).json({ success: true, data: await svc.createSession(req.body || {}) }); }
  catch (e) { sendError(res, req, e); }
});
const setSessionStatus = asyncHandler(async (req, res) => {
  try {
    const r = await svc.setSessionStatus(req.params.id, (req.body || {}).status);
    if (!r) return notFound(res, 'Session');
    res.status(200).json({ success: true, data: r });
  } catch (e) { sendError(res, req, e); }
});

module.exports = { getHalls, createHall, getSessions, getSessionById, createSession, setSessionStatus };
