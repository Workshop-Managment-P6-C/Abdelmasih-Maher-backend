// Inventory: parts catalogue + append-only stock ledger + reorder baseline.
const db = require('../config/db');
const { toJson } = require('../utils/helpers');

function bad(msg, code = 'VALIDATION_ERROR', status = 400) {
  const e = new Error(msg); e.statusCode = status; e.code = code; return e;
}

// ---------- Parts ----------
async function listParts({ category, q } = {}) {
  let sql = 'SELECT * FROM part WHERE COALESCE(is_active,true)=true';
  const p = [];
  if (category) { p.push(category); sql += ` AND category = $${p.length}`; }
  if (q) { p.push(`%${q}%`); sql += ` AND sku ILIKE $${p.length}`; }
  sql += ' ORDER BY sku ASC';
  const { rows } = await db.query(sql, p);
  return rows;
}
async function getPartById(id) {
  const { rows } = await db.query('SELECT * FROM part WHERE id = $1', [id]);
  return rows[0] || null;
}
async function createPart({ sku, barcode, name, name_en, name_ar, category, compatible_models, unit, average_cost, min_level, max_level }) {
  if (!sku) throw bad('sku is required');
  const nameVal = name || (name_en || name_ar ? { en: name_en || '', ar: name_ar || '' } : null);
  if (!nameVal) throw bad('name (or name_en/name_ar) is required');
  const { rows } = await db.query(
    `INSERT INTO part (sku, barcode, name, category, compatible_models, unit, average_cost, min_level, max_level)
     VALUES ($1,$2,$3::jsonb,$4,$5::jsonb,$6,$7,$8,$9) RETURNING *`,
    [sku, barcode || null, toJson(nameVal), category || null,
     compatible_models ? toJson(compatible_models) : null, unit || 'pcs',
     average_cost ?? null, min_level ?? 0, max_level ?? null]
  );
  return rows[0];
}
async function updatePart(id, patch) {
  const nameVal = patch.name || (patch.name_en || patch.name_ar ? { en: patch.name_en, ar: patch.name_ar } : null);
  const { rows } = await db.query(
    `UPDATE part SET sku = COALESCE($1, sku), barcode = COALESCE($2, barcode),
      name = COALESCE($3::jsonb, name), category = COALESCE($4, category),
      compatible_models = COALESCE($5::jsonb, compatible_models), unit = COALESCE($6, unit),
      average_cost = COALESCE($7, average_cost), min_level = COALESCE($8, min_level),
      max_level = COALESCE($9, max_level), is_active = COALESCE($10, is_active)
     WHERE id = $11 RETURNING *`,
    [patch.sku || null, patch.barcode ?? null, nameVal ? toJson(nameVal) : null,
     patch.category || null, patch.compatible_models ? toJson(patch.compatible_models) : null,
     patch.unit || null, patch.average_cost ?? null, patch.min_level ?? null,
     patch.max_level ?? null, typeof patch.is_active === 'boolean' ? patch.is_active : null, id]
  );
  return rows[0] || null;
}

// ---------- Stock ledger ----------
async function balance(partId, storeCode) {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(quantity),0)::int AS on_hand FROM stock_movement WHERE part_id = $1 AND store_code = $2`,
    [partId, storeCode]
  );
  return rows[0].on_hand;
}
async function balances({ store_code } = {}) {
  let sql = `SELECT p.id AS part_id, p.sku, m.store_code,
      COALESCE(SUM(m.quantity),0)::int AS on_hand, p.min_level, p.max_level
    FROM part p LEFT JOIN stock_movement m ON m.part_id = p.id`;
  const p = [];
  if (store_code) { p.push(store_code); sql += ` AND m.store_code = $${p.length}`; }
  sql += ` GROUP BY p.id, p.sku, m.store_code, p.min_level, p.max_level ORDER BY p.sku`;
  const { rows } = await db.query(sql, p);
  return rows;
}
async function listMovements({ part_id, store_code, job_card_id } = {}) {
  let sql = 'SELECT * FROM stock_movement';
  const p = []; const c = [];
  if (part_id) { p.push(part_id); c.push(`part_id = $${p.length}`); }
  if (store_code) { p.push(store_code); c.push(`store_code = $${p.length}`); }
  if (job_card_id) { p.push(job_card_id); c.push(`job_card_id = $${p.length}`); }
  if (c.length) sql += ' WHERE ' + c.join(' AND ');
  sql += ' ORDER BY created_at DESC LIMIT 500';
  const { rows } = await db.query(sql, p);
  return rows;
}
// types: RECEIPT(+) ISSUE(-) RESERVATION RELEASE TRANSFER_* COUNT_ADJUSTMENT ADJUSTMENT REVERSAL
const SIGNED = { RECEIPT: 1, ISSUE: -1, TRANSFER_IN: 1, TRANSFER_OUT: -1 };
async function move({ part_id, store_code = 'S1', type, quantity, unit_cost, reason, job_card_id, purchase_order_line_id, reverses_id, created_by }) {
  if (!part_id || !type) throw bad('part_id and type are required');
  if (!quantity || quantity <= 0) throw bad('quantity must be > 0');
  if (['ADJUSTMENT', 'COUNT_ADJUSTMENT', 'REVERSAL'].includes(type) && !reason)
    throw bad('reason is required for adjustments and reversals');
  const sign = SIGNED[type] ?? 0;
  const qty = sign !== 0 ? sign * Math.abs(quantity) : quantity;
  if (type === 'ISSUE') {
    const onHand = await balance(part_id, store_code);
    if (onHand < quantity) {
      const e = new Error(`Only ${onHand} units available`);
      e.statusCode = 422; e.code = 'INSUFFICIENT_STOCK'; throw e;
    }
  }
  const { rows } = await db.query(
    `INSERT INTO stock_movement (part_id, store_code, type, quantity, unit_cost, reason, job_card_id, purchase_order_line_id, reverses_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [part_id, store_code, type, qty, unit_cost ?? null, reason || null,
     job_card_id || null, purchase_order_line_id || null, reverses_id || null, created_by]
  );
  return rows[0];
}

// ---------- Reorder baseline (WST-FR-14, rules first) ----------
// available = on-hand + open PO quantity; suggest when available <= min_level.
async function reorderSuggestions() {
  const { rows } = await db.query(`
    SELECT p.id AS part_id, p.sku, p.min_level, p.max_level,
      COALESCE(SUM(m.quantity),0)::int AS on_hand,
      COALESCE((SELECT SUM(l.quantity - l.received_quantity) FROM purchase_order_line l
        JOIN purchase_order o ON o.id = l.purchase_order_id
        WHERE l.part_id = p.id AND o.status IN ('APPROVED','PARTIALLY_RECEIVED')),0)::int AS open_po_qty
    FROM part p LEFT JOIN stock_movement m ON m.part_id = p.id
    WHERE COALESCE(p.is_active,true)=true
    GROUP BY p.id, p.sku, p.min_level, p.max_level`);
  return rows
    .map((r) => {
      const available = r.on_hand + r.open_po_qty;
      const need = (r.max_level ?? r.min_level) - available;
      return { ...r, available, suggested_qty: need > 0 && available <= r.min_level ? need : 0, rule_version: 'reorder-v1' };
    })
    .filter((r) => r.suggested_qty > 0);
}

module.exports = {
  listParts, getPartById, createPart, updatePart,
  balance, balances, listMovements, move, reorderSuggestions,
};
