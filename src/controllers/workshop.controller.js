const svc = require('../services/workshop.service');
const { asyncHandler, sendError } = require('../middlewares/http.middleware');

const notFound = (res, entity) => res.status(404).json({ error: { code: 'NOT_FOUND', message: `${entity} not found`, requestId: `req_${Date.now()}` } });
const uid = (req) => (req.user ? req.user.userId : null);

// ---------- Customers ----------
const getCustomers = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.listCustomers() }); }
  catch (e) { sendError(res, req, e); }
});
const getCustomerById = asyncHandler(async (req, res) => {
  try {
    const row = await svc.getCustomerById(req.params.id);
    if (!row) return notFound(res, 'Customer');
    res.status(200).json({ success: true, data: row });
  } catch (e) { sendError(res, req, e); }
});
const createCustomer = asyncHandler(async (req, res) => {
  try { res.status(201).json({ success: true, data: await svc.createCustomer(req.body || {}) }); }
  catch (e) { sendError(res, req, e); }
});
const updateCustomer = asyncHandler(async (req, res) => {
  try {
    const row = await svc.updateCustomer(req.params.id, req.body || {});
    if (!row) return notFound(res, 'Customer');
    res.status(200).json({ success: true, data: row });
  } catch (e) { sendError(res, req, e); }
});

// ---------- Vehicles ----------
const getVehicles = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.listVehicles(req.query) }); }
  catch (e) { sendError(res, req, e); }
});
const getVehicleById = asyncHandler(async (req, res) => {
  try {
    const row = await svc.getVehicleById(req.params.id);
    if (!row) return notFound(res, 'Vehicle');
    res.status(200).json({ success: true, data: row });
  } catch (e) { sendError(res, req, e); }
});
const createVehicle = asyncHandler(async (req, res) => {
  try { res.status(201).json({ success: true, data: await svc.createVehicle(req.body || {}) }); }
  catch (e) { sendError(res, req, e); }
});
const updateVehicle = asyncHandler(async (req, res) => {
  try {
    const row = await svc.updateVehicle(req.params.id, req.body || {});
    if (!row) return notFound(res, 'Vehicle');
    res.status(200).json({ success: true, data: row });
  } catch (e) { sendError(res, req, e); }
});
const deleteVehicle = asyncHandler(async (req, res) => {
  try {
    const row = await svc.deleteVehicle(req.params.id);
    if (!row) return notFound(res, 'Vehicle');
    res.status(200).json({ success: true, message: 'Vehicle archived' });
  } catch (e) { sendError(res, req, e); }
});

// ---------- Bays ----------
const getBays = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.listBays() }); }
  catch (e) { sendError(res, req, e); }
});
const createBay = asyncHandler(async (req, res) => {
  try { res.status(201).json({ success: true, data: await svc.createBay(req.body || {}) }); }
  catch (e) { sendError(res, req, e); }
});

// ---------- Job cards ----------
const getJobCards = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.listJobCards(req.query, req.user) }); }
  catch (e) { sendError(res, req, e); }
});
const getJobCardById = asyncHandler(async (req, res) => {
  try {
    const row = await svc.getJobCardById(req.params.id, req.user);
    if (!row) return notFound(res, 'Job card');
    res.status(200).json({ success: true, data: row });
  } catch (e) { sendError(res, req, e); }
});
const createJobCard = asyncHandler(async (req, res) => {
  try { res.status(201).json({ success: true, data: await svc.createJobCard({ ...req.body, created_by: uid(req) }) }); }
  catch (e) { sendError(res, req, e); }
});
const updateJobCard = asyncHandler(async (req, res) => {
  try {
    const row = await svc.updateJobCard(req.params.id, req.body || {}, uid(req), req.user);
    if (!row) return notFound(res, 'Job card');
    res.status(200).json({ success: true, data: row });
  } catch (e) { sendError(res, req, e); }
});
const transitionStage = asyncHandler(async (req, res) => {
  try {
    const { to_stage, toStage, stage, note } = req.body || {};
    const target = to_stage || toStage || stage;
    if (!target) return sendError(res, req, Object.assign(new Error('to_stage is required'), { statusCode: 400, code: 'VALIDATION_ERROR' }));
    const row = await svc.transitionStage(req.params.id, target, uid(req), note, req.user);
    if (!row) return notFound(res, 'Job card');
    res.status(200).json({ success: true, data: row });
  } catch (e) { sendError(res, req, e); }
});
const getJobStages = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.listJobStages(req.params.id, req.user) }); }
  catch (e) { sendError(res, req, e); }
});

// ---------- Work items / labour ----------
const getWorkItems = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.listWorkItems(req.params.id, req.user) }); }
  catch (e) { sendError(res, req, e); }
});
const createWorkItem = asyncHandler(async (req, res) => {
  try { res.status(201).json({ success: true, data: await svc.createWorkItem(req.params.id, req.body || {}, req.user) }); }
  catch (e) { sendError(res, req, e); }
});
const approveWorkItem = asyncHandler(async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.approved_by) body.approved_by = uid(req);
    const row = await svc.approveWorkItem(req.params.id, body);
    if (!row) return notFound(res, 'Work item');
    res.status(200).json({ success: true, data: row });
  } catch (e) { sendError(res, req, e); }
});
const getLabor = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.listLabor(req.params.id, req.user) }); }
  catch (e) { sendError(res, req, e); }
});
const logLabor = asyncHandler(async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.technician_id && uid(req)) body.technician_id = uid(req);
    res.status(201).json({ success: true, data: await svc.logLabor(req.params.id, body, req.user) });
  } catch (e) { sendError(res, req, e); }
});

// ---------- Bay bookings ----------
const getBayBookings = asyncHandler(async (req, res) => {
  try { res.status(200).json({ success: true, data: await svc.listBayBookings(req.query) }); }
  catch (e) { sendError(res, req, e); }
});
const createBayBooking = asyncHandler(async (req, res) => {
  try { res.status(201).json({ success: true, data: await svc.createBayBooking(req.body || {}) }); }
  catch (e) { sendError(res, req, e); }
});

module.exports = {
  getCustomers, getCustomerById, createCustomer, updateCustomer,
  getVehicles, getVehicleById, createVehicle, updateVehicle, deleteVehicle,
  getBays, createBay,
  getJobCards, getJobCardById, createJobCard, updateJobCard, transitionStage, getJobStages,
  getWorkItems, createWorkItem, approveWorkItem,
  getLabor, logLabor,
  getBayBookings, createBayBooking,
};
