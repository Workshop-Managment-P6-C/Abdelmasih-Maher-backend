// Purchasing: vendors (composite on PO), orders, two-approval rule, goods receipt.
const db = require('../config/db');

const THRESHOLD = Number(process.env.PO_APPROVAL_THRESHOLD || 5000);

function bad(msg, code = 'VALIDATION_ERROR', status = 400) {
  const e = new Error(msg); e.statusCode = status; e.code = code; return e;
}

async function listPOs({ status } = {}) {
  let sql = 'SELECT * FROM purchase_order';
  const p = [];
  if (status) { p.push(status); sql += ` WHERE status = $1`; }
  sql += ' ORDER BY created_at DESC';
  const { rows } = await db.query(sql, p);
  return rows;
}
async function getPOById(id) {
  const { rows } = await db.query('SELECT * FROM purchase_order WHERE id = $1', [id]);
  if (!rows[0]) return null;
  const lines = await db.query('SELECT * FROM purchase_order_line WHERE purchase_order_id = $1', [id]);
  return { ...rows[0], lines: lines.rows };
}
async function createPO({ vendor_name, vendor_contact_phone, vendor_contact_email, lines = [], created_by }) {
  if (!vendor_name) throw bad('vendor_name is required');
  if (!lines.length) throw bad('at least one line is required');
  const total = lines.reduce((s, l) => s + (l.quantity * (l.unit_price || 0)), 0);
  const poNumber = `PO-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO purchase_order (po_number, vendor_name, vendor_contact_phone, vendor_contact_email, status, total_amount, approvals_required, created_by)
       VALUES ($1,$2,$3,$4,'DRAFT',$5,$6,$7) RETURNING *`,
      [poNumber, vendor_name, vendor_contact_phone || null, vendor_contact_email || null,
       total, total > THRESHOLD ? 2 : 1, created_by]
    );
    for (const l of lines) {
      if (!l.part_id || !l.quantity || l.quantity <= 0) throw bad('each line needs part_id and quantity > 0');
      await client.query(
        `INSERT INTO purchase_order_line (purchase_order_id, part_id, quantity, unit_price) VALUES ($1,$2,$3,$4)`,
        [rows[0].id, l.part_id, l.quantity, l.unit_price ?? null]
      );
    }
    await client.query('COMMIT');
    return getPOById(rows[0].id);
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}
async function submitPO(id) {
  const { rows } = await db.query(
    `UPDATE purchase_order SET status = 'SUBMITTED', submitted_at = NOW()
     WHERE id = $1 AND status = 'DRAFT' RETURNING *`, [id]);
  if (!rows[0]) throw bad('PO must be in DRAFT to submit', 'INVALID_STATE', 422);
  return rows[0];
}
async function approvePO(id, approver) {
  const po = await getPOById(id);
  if (!po) return null;
  if (!['SUBMITTED', 'APPROVED'].includes(po.status)) throw bad('PO must be SUBMITTED to approve', 'INVALID_STATE', 422);
  if (po.created_by === approver) throw bad('approver must differ from creator', 'FORBIDDEN', 403);
  if (po.approval1_by === approver || po.approval2_by === approver) throw bad('same user cannot approve twice', 'CONFLICT', 409);
  let sql, params;
  if (!po.approval1_by) {
    sql = `UPDATE purchase_order SET approval1_by = $1, approval1_at = NOW(),
      status = CASE WHEN approvals_required <= 1 THEN 'APPROVED' ELSE status END WHERE id = $2 RETURNING *`;
    params = [approver, id];
  } else if (po.approvals_required >= 2 && !po.approval2_by) {
    if (po.approval1_by === approver) throw bad('second approver must differ from first', 'CONFLICT', 409);
    sql = `UPDATE purchase_order SET approval2_by = $1, approval2_at = NOW(), status = 'APPROVED' WHERE id = $2 RETURNING *`;
    params = [approver, id];
  } else throw bad('PO already has enough approvals', 'CONFLICT', 409);
  const { rows } = await db.query(sql, params);
  return rows[0];
}
// Goods receipt: accepted qty -> RECEIPT movements + received_quantity; stock changes only here.
async function receivePO(id, { lines = [], received_by }) {
  const po = await getPOById(id);
  if (!po) return null;
  if (!['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status)) throw bad('PO must be APPROVED to receive', 'INVALID_STATE', 422);
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    for (const l of lines) {
      const line = po.lines.find((x) => x.id === l.line_id);
      if (!line) throw bad(`unknown line ${l.line_id}`);
      const accepted = l.accepted_quantity || 0, rejected = l.rejected_quantity || 0;
      if (accepted < 0 || rejected < 0 || accepted + rejected === 0) throw bad('accepted/rejected quantities invalid');
      if (line.received_quantity + accepted > line.quantity) throw bad('cannot receive more than ordered');
      await client.query(
        `UPDATE purchase_order_line SET received_quantity = received_quantity + $1, rejected_quantity = rejected_quantity + $2 WHERE id = $3`,
        [accepted, rejected, line.id]);
      if (accepted > 0) {
        await client.query(
          `INSERT INTO stock_movement (part_id, store_code, type, quantity, unit_cost, purchase_order_line_id, created_by)
           VALUES ($1,'S1','RECEIPT',$2,$3,$4,$5)`,
          [line.part_id, accepted, line.unit_price, line.id, received_by]);
      }
    }
    const { rows: agg } = await client.query(
      `SELECT SUM(quantity) o, SUM(received_quantity) r FROM purchase_order_line WHERE purchase_order_id = $1`, [id]);
    const status = agg[0].r >= agg[0].o ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
    await client.query(`UPDATE purchase_order SET status = $1 WHERE id = $2`, [status, id]);
    await client.query('COMMIT');
    return getPOById(id);
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

module.exports = { listPOs, getPOById, createPO, submitPO, approvePO, receivePO, THRESHOLD };
