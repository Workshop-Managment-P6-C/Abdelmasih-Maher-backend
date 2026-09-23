const svc = require('../services/purchasing.service');
const { asyncHandler, sendError } = require('../middlewares/http.middleware');
const { uid } = require('../utils/helpers');

const notFound = (res, e) => res.status(404).json({ error: { code: 'NOT_FOUND', message: `${e} not found`, requestId: `req_${Date.now()}` } });

const getPOs = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.listPOs(req.query) }); }
  catch (e) { sendError(res, req, e); }
});
const getPOById = asyncHandler(async (req, res) => {
  try {
    const r = await svc.getPOById(req.params.id);
    if (!r) return notFound(res, 'Purchase order');
    res.status(200).json({ success: true, data: r });
  } catch (e) { sendError(res, req, e); }
});
const createPO = asyncHandler(async (req, res) => {
  try { res.status(201).json({ success: true, data: await svc.createPO({ ...req.body, created_by: uid(req) }) }); }
  catch (e) { sendError(res, req, e); }
});
const submitPO = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.submitPO(req.params.id) }); }
  catch (e) { sendError(res, req, e); }
});
const approvePO = asyncHandler(async (req, res) => {
  try {
    const r = await svc.approvePO(req.params.id, uid(req));
    if (!r) return notFound(res, 'Purchase order');
    res.status(200).json({ success: true, data: r });
  } catch (e) { sendError(res, req, e); }
});
const receivePO = asyncHandler(async (req, res) => {
  try {
    const r = await svc.receivePO(req.params.id, { ...(req.body || {}), received_by: uid(req) });
    if (!r) return notFound(res, 'Purchase order');
    res.status(200).json({ success: true, data: r });
  } catch (e) { sendError(res, req, e); }
});

module.exports = { getPOs, getPOById, createPO, submitPO, approvePO, receivePO };
