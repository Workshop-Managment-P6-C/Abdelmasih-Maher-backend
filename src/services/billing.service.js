// Billing: invoices computed from logged labour + issued parts (never typed by hand).
const db = require('../config/db');

function bad(msg, code = 'VALIDATION_ERROR', status = 400) {
  const e = new Error(msg); e.statusCode = status; e.code = code; return e;
}

async function listInvoices({ job_card_id, status } = {}) {
  let sql = 'SELECT * FROM invoice';
  const p = []; const c = [];
  if (job_card_id) { p.push(job_card_id); c.push(`job_card_id = $${p.length}`); }
  if (status) { p.push(status); c.push(`status = $${p.length}`); }
  if (c.length) sql += ' WHERE ' + c.join(' AND ');
  sql += ' ORDER BY issued_at DESC NULLS LAST, invoice_number DESC';
  const { rows } = await db.query(sql, p);
  return rows;
}
async function getInvoiceById(id) {
  const { rows } = await db.query('SELECT * FROM invoice WHERE id = $1', [id]);
  if (!rows[0]) return null;
  const lines = await db.query('SELECT * FROM invoice_line WHERE invoice_id = $1', [id]);
  return { ...rows[0], lines: lines.rows };
}
// Build a DRAFT invoice from uninvoiced sources of a job.
async function computeInvoice({ job_card_id, hourly_rate = 100, discount = 0, tax = 0 }) {
  if (!job_card_id) throw bad('job_card_id is required');
  const uninvoicedLabor = await db.query(
    `SELECT e.* FROM labor_entry e LEFT JOIN invoice_line l ON l.labor_entry_id = e.id
     WHERE e.job_card_id = $1 AND l.id IS NULL`, [job_card_id]);
  const uninvoicedParts = await db.query(
    `SELECT m.* FROM stock_movement m LEFT JOIN invoice_line l ON l.stock_movement_id = m.id
     WHERE m.job_card_id = $1 AND m.type = 'ISSUE' AND l.id IS NULL`, [job_card_id]);
  if (!uninvoicedLabor.rows.length && !uninvoicedParts.rows.length)
    throw bad('nothing new to invoice for this job', 'CONFLICT', 409);
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const invNo = `INV-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
    const { rows: inv } = await client.query(
      `INSERT INTO invoice (invoice_number, job_card_id, status, discount, tax, subtotal, total_amount)
       VALUES ($1,$2,'DRAFT',$3,$4,0,0) RETURNING *`, [invNo, job_card_id, discount, tax]);
    let subtotal = 0;
    for (const e of uninvoicedLabor.rows) {
      const qty = e.minutes / 60, price = hourly_rate, amount = qty * price;
      subtotal += amount;
      await client.query(
        `INSERT INTO invoice_line (invoice_id, kind, labor_entry_id, description, quantity, unit_price)
         VALUES ($1,'LABOUR',$2,$3,$4,$5)`, [inv[0].id, e.id, `Labour ${e.minutes}min`, qty, price]);
    }
    for (const m of uninvoicedParts.rows) {
      const qty = Math.abs(m.quantity), price = Number(m.unit_cost || 0), amount = qty * price;
      subtotal += amount;
      await client.query(
        `INSERT INTO invoice_line (invoice_id, kind, stock_movement_id, description, quantity, unit_price)
         VALUES ($1,'PART',$2,$3,$4,$5)`, [inv[0].id, m.id, `Part issue`, qty, price]);
    }
    const total = subtotal - Number(discount) + Number(tax);
    const { rows: done } = await client.query(
      `UPDATE invoice SET subtotal = $1, total_amount = $2 WHERE id = $3 RETURNING *`, [subtotal, total, inv[0].id]);
    await client.query('COMMIT');
    return getInvoiceById(done[0].id);
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}
async function setInvoiceStatus(id, status) {
  const allowed = ['ISSUED', 'PAID', 'VOID'];
  if (!allowed.includes(status)) throw bad(`status must be one of ${allowed.join(', ')}`);
  const extra = status === 'ISSUED' ? ', issued_at = NOW()' : status === 'PAID' ? ', paid_at = NOW()' : '';
  const { rows } = await db.query(
    `UPDATE invoice SET status = $1${extra} WHERE id = $2 AND status <> 'VOID' RETURNING *`, [status, id]);
  return rows[0] || null;
}

module.exports = { listInvoices, getInvoiceById, computeInvoice, setInvoiceStatus };
