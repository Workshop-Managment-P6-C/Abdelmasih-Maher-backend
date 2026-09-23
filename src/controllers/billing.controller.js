const svc = require('../services/billing.service');
const { asyncHandler, sendError } = require('../middlewares/http.middleware');

const notFound = (res, e) => res.status(404).json({ error: { code: 'NOT_FOUND', message: `${e} not found`, requestId: `req_${Date.now()}` } });

const getInvoices = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.listInvoices(req.query) }); }
  catch (e) { sendError(res, req, e); }
});
const getInvoiceById = asyncHandler(async (req, res) => {
  try {
    const r = await svc.getInvoiceById(req.params.id);
    if (!r) return notFound(res, 'Invoice');
    res.status(200).json({ success: true, data: r });
  } catch (e) { sendError(res, req, e); }
});
const computeInvoice = asyncHandler(async (req, res) => {
  try { res.status(201).json({ success: true, data: await svc.computeInvoice(req.body || {}) }); }
  catch (e) { sendError(res, req, e); }
});
const setInvoiceStatus = asyncHandler(async (req, res) => {
  try {
    const r = await svc.setInvoiceStatus(req.params.id, (req.body || {}).status);
    if (!r) return notFound(res, 'Invoice');
    res.status(200).json({ success: true, data: r });
  } catch (e) { sendError(res, req, e); }
});

module.exports = { getInvoices, getInvoiceById, computeInvoice, setInvoiceStatus };
