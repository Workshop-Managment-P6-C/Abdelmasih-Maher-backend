// Insights: dashboards, CSV exports, rule-baseline predictions, attachments, notifications.
const db = require('../config/db');
const crypto = require('crypto');

function bad(msg, code = 'VALIDATION_ERROR', status = 400) {
  const e = new Error(msg); e.statusCode = status; e.code = code; return e;
}

// ---------- Dashboards (role-scoped in routes via authorize) ----------
async function jobsDashboard() {
  const byStage = await db.query(`SELECT stage, COUNT(*)::int AS count FROM job_card GROUP BY stage`);
  const turn = await db.query(`SELECT COUNT(*)::int AS delivered,
    COALESCE(AVG(EXTRACT(EPOCH FROM (delivered_at - created_at))/86400),0)::float AS avg_days
    FROM job_card WHERE stage = 'DELIVERED' AND delivered_at IS NOT NULL`);
  const util = await db.query(`SELECT b.name AS bay, COUNT(j.id)::int AS jobs
    FROM bay b LEFT JOIN job_card j ON j.bay_id = b.id GROUP BY b.name ORDER BY b.name`);
  return { by_stage: byStage.rows, turnaround: turn.rows[0], bay_utilization: util.rows };
}
async function stockDashboard() {
  const { rows } = await db.query(`
    SELECT p.sku, m.store_code, COALESCE(SUM(m.quantity),0)::int AS on_hand, p.min_level, p.max_level
    FROM part p LEFT JOIN stock_movement m ON m.part_id = p.id
    WHERE COALESCE(p.is_active,true)=true
    GROUP BY p.sku, m.store_code, p.min_level, p.max_level ORDER BY p.sku`);
  return { balances: rows, below_min: rows.filter((r) => r.on_hand <= (r.min_level ?? 0)) };
}
async function trainingDashboard() {
  const att = await db.query(`SELECT COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE status = 'PRESENT')::int AS present FROM attendance`);
  const assess = await db.query(`SELECT COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE signed_at IS NOT NULL)::int AS signed FROM assessment`);
  const comp = await db.query(`SELECT c.code AS course,
    COUNT(DISTINCT t.id)::int AS tasks,
    COUNT(DISTINCT CASE WHEN a.result = 'PASS' AND a.signed_at IS NOT NULL THEN a.practical_task_id END)::int AS passed_signed
    FROM course c LEFT JOIN practical_task t ON t.course_id = c.id
    LEFT JOIN assessment a ON a.practical_task_id = t.id GROUP BY c.code ORDER BY c.code`);
  return { attendance: att.rows[0], assessments: assess.rows[0], competency: comp.rows };
}

// ---------- CSV exports (totals reconcile to source: same filters, raw rows) ----------
function toCSV(rows) {
  if (!rows.length) return '';
  const head = Object.keys(rows[0]);
  const esc = (v) => (v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return head.join(',') + '\n' + rows.map((r) => head.map((h) => esc(typeof r[h] === 'object' ? JSON.stringify(r[h]) : r[h])).join(',')).join('\n');
}
async function exportJobs() {
  const { rows } = await db.query(`SELECT id, job_number, vehicle_id, stage, technician_id, bay_id, created_at, delivered_at FROM job_card ORDER BY created_at DESC`);
  return toCSV(rows);
}
async function exportStock() {
  const { rows } = await db.query(`SELECT m.id, p.sku, m.store_code, m.type, m.quantity, m.created_at FROM stock_movement m JOIN part p ON p.id = m.part_id ORDER BY m.created_at DESC`);
  return toCSV(rows);
}
async function exportAttendance() {
  const { rows } = await db.query(`SELECT training_session_id, student_id, status, recorded_at FROM attendance ORDER BY recorded_at DESC`);
  return toCSV(rows);
}

// ---------- Predictions (advisory, versioned, explainable) ----------
async function listPredictions({ kind } = {}) {
  const { rows } = kind
    ? await db.query('SELECT * FROM prediction WHERE kind = $1 ORDER BY created_at DESC', [kind])
    : await db.query('SELECT * FROM prediction ORDER BY created_at DESC');
  return rows;
}
async function trainingRisk(studentId) {
  const att = await db.query(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE status IN ('ABSENT'))::int missed FROM attendance WHERE student_id = $1`, [studentId]);
  const as = await db.query(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE signed_at IS NULL)::int unsigned FROM assessment WHERE student_id = $1`, [studentId]);
  const reasons = [];
  if (att.rows[0].missed > 2) reasons.push(`${att.rows[0].missed} absences`);
  if (as.rows[0].unsigned > 0) reasons.push(`${as.rows[0].unsigned} unsigned assessments`);
  const level = reasons.length >= 2 ? 'High' : reasons.length === 1 ? 'Medium' : 'Low';
  const { rows } = await db.query(
    `INSERT INTO prediction (kind, subject_type, subject_id, inputs, baseline_version, output, explanation)
     VALUES ('TRAINING_RISK','STUDENT',$1,$2,'risk-v1',$3,$4) RETURNING *`,
    [studentId, JSON.stringify({ attendance: att.rows[0], assessments: as.rows[0] }), level, reasons.join('; ') || 'no risk signals']);
  return rows[0];
}
async function decidePrediction(id, { decision, decided_by, outcome }) {
  if (!['ACCEPTED', 'OVERRIDDEN', 'IGNORED'].includes(decision)) throw bad('decision must be ACCEPTED, OVERRIDDEN or IGNORED');
  const { rows } = await db.query(
    `UPDATE prediction SET decision = $1, decided_by = $2, outcome = $3 WHERE id = $4 RETURNING *`, [decision, decided_by || null, outcome || null, id]);
  return rows[0] || null;
}

// ---------- Attachments (metadata; files stay in private storage) ----------
async function addAttachment({ owner_type, owner_id, file_name, mime_type, size_bytes, uploaded_by }) {
  if (!owner_type || !owner_id || !file_name || !mime_type || !size_bytes || !uploaded_by) throw bad('owner_type, owner_id, file_name, mime_type, size_bytes, uploaded_by are required');
  const key = crypto.randomBytes(16).toString('hex');
  const { rows } = await db.query(
    `INSERT INTO attachment (owner_type, owner_id, file_name, mime_type, size_bytes, storage_key, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [owner_type, owner_id, file_name, mime_type, size_bytes, key, uploaded_by]);
  return rows[0];
}
async function listAttachments(ownerType, ownerId) {
  const { rows } = await db.query('SELECT * FROM attachment WHERE owner_type = $1 AND owner_id = $2 ORDER BY uploaded_at DESC', [ownerType, ownerId]);
  return rows;
}

// ---------- Notifications ----------
async function listNotifications(userId) {
  const { rows } = await db.query('SELECT * FROM notification WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return rows;
}
async function createNotification({ user_id, type, body }) {
  if (!user_id || !body) throw bad('user_id and body are required');
  const { rows } = await db.query('INSERT INTO notification (user_id, type, body) VALUES ($1,$2,$3) RETURNING *', [user_id, type || null, body]);
  return rows[0];
}
async function readNotification(id, userId = null) {
  const { rows } = await db.query(
    'UPDATE notification SET read_at = NOW() WHERE id = $1 AND ($2::uuid IS NULL OR user_id = $2) RETURNING *',
    [id, userId]
  );
  return rows[0] || null;
}

module.exports = {
  jobsDashboard, stockDashboard, trainingDashboard,
  exportJobs, exportStock, exportAttendance,
  listPredictions, trainingRisk, decidePrediction,
  addAttachment, listAttachments,
  listNotifications, createNotification, readNotification,
};
