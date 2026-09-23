// Workshop-domain data access. PostgreSQL $n placeholders, wst schema (P6-C ERD v3).
const db = require('../config/db');

const STAGES = ['RECEIVED', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY', 'DELIVERED'];
// Allowed transitions: forward flow + QC rework loop back to IN_PROGRESS.
const ALLOWED = {
  RECEIVED: ['IN_PROGRESS'],
  IN_PROGRESS: ['QUALITY_CHECK'],
  QUALITY_CHECK: ['READY', 'IN_PROGRESS'],
  READY: ['DELIVERED'],
  DELIVERED: [],
};

function bad(msg) {
  const e = new Error(msg);
  e.statusCode = 400; e.code = 'VALIDATION_ERROR';
  return e;
}

// ---------- Customers (app_user with role=CUSTOMER) ----------
const CUSTOMER_COLS = 'id, email, full_name, role, phone, contact_preference, is_active, created_at';
async function listCustomers() {
  const { rows } = await db.query(`SELECT ${CUSTOMER_COLS} FROM app_user WHERE role = 'CUSTOMER' AND COALESCE(is_archived,false) = false ORDER BY created_at DESC`);
  return rows;
}
async function getCustomerById(id) {
  const { rows } = await db.query(`SELECT ${CUSTOMER_COLS} FROM app_user WHERE id = $1 AND role = 'CUSTOMER'`, [id]);
  return rows[0] || null;
}
async function createCustomer({ full_name, name, email, phone, contact_preference }) {
  const displayName = full_name || name;
  if (!displayName) throw bad('full_name is required');
  if (email) {
    const { rows: dup } = await db.query('SELECT id FROM app_user WHERE email = $1', [email]);
    if (dup.length) { const e = new Error('Email already registered'); e.statusCode = 409; e.code = 'CONFLICT'; throw e; }
  }
  const { rows } = await db.query(
    `INSERT INTO app_user (full_name, email, password_hash, role, phone, contact_preference)
     VALUES ($1, $2, NULL, 'CUSTOMER', $3, $4) RETURNING ${CUSTOMER_COLS}`,
    [displayName, email || null, phone || null, contact_preference || null]
  );
  return rows[0];
}
async function updateCustomer(id, { full_name, name, email, phone, contact_preference }) {
  const { rows } = await db.query(
    `UPDATE app_user SET full_name = COALESCE($1, full_name), email = COALESCE($2, email),
      phone = COALESCE($3, phone), contact_preference = COALESCE($4, contact_preference), updated_at = NOW()
     WHERE id = $5 AND role = 'CUSTOMER' RETURNING ${CUSTOMER_COLS}`,
    [full_name || name || null, email || null, phone || null, contact_preference || null, id]
  );
  return rows[0] || null;
}

// ---------- Vehicles ----------
async function listVehicles({ customer_id } = {}) {
  if (customer_id) {
    const { rows } = await db.query('SELECT * FROM vehicle WHERE customer_id = $1 AND COALESCE(is_archived,false)=false ORDER BY created_at DESC', [customer_id]);
    return rows;
  }
  const { rows } = await db.query('SELECT * FROM vehicle WHERE COALESCE(is_archived,false)=false ORDER BY created_at DESC');
  return rows;
}
async function getVehicleById(id) {
  const { rows } = await db.query('SELECT * FROM vehicle WHERE id = $1', [id]);
  return rows[0] || null;
}
async function createVehicle({ customer_id, plate_number, vin, make, model, year, current_mileage, next_service_date, next_service_mileage, service_interval_km }) {
  if (!customer_id) throw bad('customer_id is required');
  const { rows } = await db.query(
    `INSERT INTO vehicle (customer_id, plate_number, vin, make, model, year, current_mileage, next_service_date, next_service_mileage, service_interval_km)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [customer_id, plate_number || null, vin || null, make || null, model || null, year || null,
     current_mileage || null, next_service_date || null, next_service_mileage || null, service_interval_km || null]
  );
  return rows[0];
}
async function updateVehicle(id, patch) {
  const { rows } = await db.query(
    `UPDATE vehicle SET plate_number = COALESCE($1, plate_number), vin = COALESCE($2, vin),
      make = COALESCE($3, make), model = COALESCE($4, model), year = COALESCE($5, year),
      current_mileage = COALESCE($6, current_mileage), next_service_date = COALESCE($7, next_service_date),
      next_service_mileage = COALESCE($8, next_service_mileage), service_interval_km = COALESCE($9, service_interval_km)
     WHERE id = $10 RETURNING *`,
    [patch.plate_number || null, patch.vin || null, patch.make || null, patch.model || null,
     patch.year ?? null, patch.current_mileage ?? null, patch.next_service_date || null,
     patch.next_service_mileage ?? null, patch.service_interval_km ?? null, id]
  );
  return rows[0] || null;
}
async function deleteVehicle(id) {
  const { rows } = await db.query('UPDATE vehicle SET is_archived = true WHERE id = $1 RETURNING id', [id]);
  return rows[0] || null;
}

// ---------- Bays ----------
async function listBays() {
  const { rows } = await db.query('SELECT * FROM bay ORDER BY name ASC');
  return rows;
}
async function createBay({ name, kind }) {
  if (!name) throw bad('name is required');
  const { rows } = await db.query('INSERT INTO bay (name, kind) VALUES ($1, $2) RETURNING *', [name, kind || 'WORKSHOP']);
  return rows[0];
}

// ---------- Job cards ----------
function jobScope(user, params, alias = 'j') {
  if (!user) return { join: '', condition: 'FALSE' };
  if (user.role === 'TECHNICIAN') {
    params.push(user.userId);
    return { join: '', condition: `${alias}.technician_id = $${params.length}` };
  }
  if (user.role === 'SERVICE_ADVISOR') {
    params.push(user.userId);
    return { join: '', condition: `${alias}.advisor_id = $${params.length}` };
  }
  if (user.role === 'CUSTOMER') {
    params.push(user.userId);
    return { join: ` JOIN vehicle v ON v.id = ${alias}.vehicle_id`, condition: `v.customer_id = $${params.length}` };
  }
  return { join: '', condition: '' };
}

async function listJobCards({ stage, technician_id, bay_id } = {}, user) {
  const params = [];
  const scope = jobScope(user, params);
  let sql = `SELECT j.* FROM job_card j${scope.join}`;
  const conds = [];
  if (scope.condition) conds.push(scope.condition);
  if (stage) { params.push(stage); conds.push(`stage = $${params.length}`); }
  if (technician_id) { params.push(technician_id); conds.push(`technician_id = $${params.length}`); }
  if (bay_id) { params.push(bay_id); conds.push(`bay_id = $${params.length}`); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY created_at DESC';
  const { rows } = await db.query(sql, params);
  return rows;
}
async function getJobCardById(id, user) {
  const params = [id];
  const scope = jobScope(user, params);
  const { rows } = await db.query(`SELECT j.* FROM job_card j${scope.join} WHERE j.id = $1${scope.condition ? ` AND ${scope.condition}` : ''}`, params);
  return rows[0] || null;
}
async function createJobCard({ job_number, vehicle_id, service_type, priority, complaint, mileage_in, bay_id, technician_id, advisor_id, promised_at, created_by }) {
  if (!vehicle_id) throw bad('vehicle_id is required');
  let jobNumber = job_number;
  if (!jobNumber) jobNumber = `JOB-${Date.now().toString(36).toUpperCase()}`;
  const { rows } = await db.query(
    `INSERT INTO job_card (job_number, vehicle_id, service_type, priority, complaint, mileage_in, stage, bay_id, technician_id, advisor_id, promised_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,'RECEIVED',$7,$8,$9,$10,$11) RETURNING *`,
    [jobNumber, vehicle_id, service_type || null, priority || null, complaint || null, mileage_in || null,
     bay_id || null, technician_id || null, advisor_id || null, promised_at || null, created_by || null]
  );
  // audit initial stage
  await db.query(`INSERT INTO job_stage (job_card_id, from_stage, to_stage, changed_by, note) VALUES ($1, NULL, 'RECEIVED', $2, 'Created')`, [rows[0].id, created_by || rows[0].advisor_id || rows[0].technician_id || rows[0].created_by || vehicle_id]);
  return rows[0];
}
async function updateJobCard(id, patch, updatedBy, user) {
  if (!(await getJobCardById(id, user))) return null;
  const { rows } = await db.query(
    `UPDATE job_card SET service_type = COALESCE($1, service_type), priority = COALESCE($2, priority),
      complaint = COALESCE($3, complaint), mileage_in = COALESCE($4, mileage_in),
      bay_id = COALESCE($5, bay_id), technician_id = COALESCE($6, technician_id),
      advisor_id = COALESCE($7, advisor_id), promised_at = COALESCE($8, promised_at),
      delivered_at = COALESCE($9, delivered_at), updated_at = NOW(), updated_by = $10
     WHERE id = $11 RETURNING *`,
    [patch.service_type || null, patch.priority || null, patch.complaint ?? null, patch.mileage_in ?? null,
     patch.bay_id || null, patch.technician_id || null, patch.advisor_id || null, patch.promised_at || null,
     patch.delivered_at || null, updatedBy || null, id]
  );
  return rows[0] || null;
}
async function transitionStage(id, toStage, changedBy, note, user) {
  if (!STAGES.includes(toStage)) throw bad(`stage must be one of ${STAGES.join(', ')}`);
  const current = await getJobCardById(id, user);
  if (!current) return null;
  const allowed = ALLOWED[current.stage] || [];
  if (!allowed.includes(toStage)) {
    const e = new Error(`Invalid transition ${current.stage} -> ${toStage}. Allowed: ${allowed.join(', ') || 'none'}`);
    e.statusCode = 422; e.code = 'INVALID_TRANSITION'; throw e;
  }
  if (user.role === 'TECHNICIAN' && !['IN_PROGRESS', 'QUALITY_CHECK'].includes(toStage)) throw bad('Technicians can only move jobs to IN_PROGRESS or QUALITY_CHECK', 'FORBIDDEN', 403);
  if (user.role === 'QUALITY_CHECKER' && !['READY', 'IN_PROGRESS'].includes(toStage)) throw bad('Quality checkers can only move jobs to READY or IN_PROGRESS', 'FORBIDDEN', 403);
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`UPDATE job_card SET stage = $1, updated_at = NOW(), updated_by = $2 WHERE id = $3 RETURNING *`, [toStage, changedBy || null, id]);
    await client.query(`INSERT INTO job_stage (job_card_id, from_stage, to_stage, changed_by, note) VALUES ($1,$2,$3,$4,$5)`, [id, current.stage, toStage, changedBy, note || null]);
    await client.query('COMMIT');
    return rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
async function listJobStages(jobId, user) {
  if (!(await getJobCardById(jobId, user))) return [];
  const { rows } = await db.query('SELECT * FROM job_stage WHERE job_card_id = $1 ORDER BY changed_at ASC', [jobId]);
  return rows;
}

// ---------- Work items ----------
async function listWorkItems(jobId, user) {
  if (!(await getJobCardById(jobId, user))) return [];
  const { rows } = await db.query('SELECT * FROM work_item WHERE job_card_id = $1 ORDER BY status, description', [jobId]);
  return rows;
}
async function createWorkItem(jobId, { description, is_billable, status }, user) {
  if (!(await getJobCardById(jobId, user))) return null;
  if (!description) throw bad('description is required');
  const { rows } = await db.query(
    `INSERT INTO work_item (job_card_id, description, is_billable, status) VALUES ($1,$2,$3,$4) RETURNING *`,
    [jobId, description, is_billable ?? true, status || 'OPEN']
  );
  return rows[0];
}
async function approveWorkItem(id, { approval, approved_by }) {
  if (!['APPROVED', 'DECLINED', 'PENDING'].includes(approval)) throw bad('approval must be PENDING, APPROVED or DECLINED');
  const { rows } = await db.query(
    `UPDATE work_item SET approval = $1, approved_by = $2, approved_at = NOW() WHERE id = $3 RETURNING *`,
    [approval, approved_by || null, id]
  );
  return rows[0] || null;
}

// ---------- Labour ----------
async function listLabor(jobId, user) {
  if (!(await getJobCardById(jobId, user))) return [];
  const { rows } = await db.query('SELECT * FROM labor_entry WHERE job_card_id = $1 ORDER BY logged_at DESC', [jobId]);
  return rows;
}
async function logLabor(jobId, { work_item_id, technician_id, minutes, note }, user) {
  if (!(await getJobCardById(jobId, user))) return null;
  if (user.role === 'TECHNICIAN') technician_id = user.userId;
  if (!technician_id) throw bad('technician_id is required');
  if (!minutes || minutes <= 0) throw bad('minutes must be > 0');
  const { rows } = await db.query(
    `INSERT INTO labor_entry (job_card_id, work_item_id, technician_id, minutes, note) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [jobId, work_item_id || null, technician_id, minutes, note || null]
  );
  return rows[0];
}

// ---------- Bay bookings ----------
async function listBayBookings({ bay_id } = {}) {
  if (bay_id) {
    const { rows } = await db.query('SELECT * FROM bay_booking WHERE bay_id = $1 ORDER BY starts_at ASC', [bay_id]);
    return rows;
  }
  const { rows } = await db.query('SELECT * FROM bay_booking ORDER BY starts_at ASC');
  return rows;
}
async function createBayBooking({ bay_id, starts_at, ends_at, source, job_card_id, training_session_id }) {
  if (!bay_id || !starts_at || !ends_at) throw bad('bay_id, starts_at and ends_at are required');
  const { rows: clash } = await db.query(
    `SELECT id FROM bay_booking WHERE bay_id = $1 AND starts_at < $3 AND ends_at > $2 LIMIT 1`,
    [bay_id, starts_at, ends_at]
  );
  if (clash.length) { const e = new Error('Bay is already booked for the requested time slot'); e.statusCode = 409; e.code = 'CONFLICT'; throw e; }
  const { rows } = await db.query(
    `INSERT INTO bay_booking (bay_id, starts_at, ends_at, source, job_card_id, training_session_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [bay_id, starts_at, ends_at, source || 'JOB', job_card_id || null, training_session_id || null]
  );
  return rows[0];
}

module.exports = {
  STAGES,
  listCustomers, getCustomerById, createCustomer, updateCustomer,
  listVehicles, getVehicleById, createVehicle, updateVehicle, deleteVehicle,
  listBays, createBay,
  listJobCards, getJobCardById, createJobCard, updateJobCard, transitionStage, listJobStages,
  listWorkItems, createWorkItem, approveWorkItem,
  listLabor, logLabor,
  listBayBookings, createBayBooking,
};
