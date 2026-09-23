const svc = require('../services/inventory.service');
const { asyncHandler, sendError } = require('../middlewares/http.middleware');
const { uid } = require('../utils/helpers');

const notFound = (res, e) => res.status(404).json({ error: { code: 'NOT_FOUND', message: `${e} not found`, requestId: `req_${Date.now()}` } });

const getParts = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.listParts(req.query) }); }
  catch (e) { sendError(res, req, e); }
});
const getPartById = asyncHandler(async (req, res) => {
  try {
    const r = await svc.getPartById(req.params.id);
    if (!r) return notFound(res, 'Part');
    res.status(200).json({ success: true, data: r });
  } catch (e) { sendError(res, req, e); }
});
const createPart = asyncHandler(async (req, res) => {
  try { res.status(201).json({ success: true, data: await svc.createPart(req.body || {}) }); }
  catch (e) { sendError(res, req, e); }
});
const updatePart = asyncHandler(async (req, res) => {
  try {
    const r = await svc.updatePart(req.params.id, req.body || {});
    if (!r) return notFound(res, 'Part');
    res.status(200).json({ success: true, data: r });
  } catch (e) { sendError(res, req, e); }
});
const getBalances = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.balances(req.query) }); }
  catch (e) { sendError(res, req, e); }
});
const getMovements = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.listMovements(req.query) }); }
  catch (e) { sendError(res, req, e); }
});
const createMovement = asyncHandler(async (req, res) => {
  try {
    res.status(201).json({ success: true, data: await svc.move({ ...req.body, created_by: (req.body || {}).created_by || uid(req) }) });
  } catch (e) { sendError(res, req, e); }
});
const getReorder = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.reorderSuggestions() }); }
  catch (e) { sendError(res, req, e); }
});

module.exports = { getParts, getPartById, createPart, updatePart, getBalances, getMovements, createMovement, getReorder };
