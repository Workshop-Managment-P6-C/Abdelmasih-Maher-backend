// Academy sessions: halls, scheduling with hall+mentor conflict detection.
const db = require('../config/db');
const { toJson } = require('../utils/helpers');

function bad(msg, code = 'VALIDATION_ERROR', status = 400) {
  const e = new Error(msg); e.statusCode = status; e.code = code; return e;
}

async function listHalls() {
  const { rows } = await db.query('SELECT * FROM hall ORDER BY name ASC');
  return rows;
}
async function createHall({ name, kind }) {
  if (!name) throw bad('name is required');
  const { rows } = await db.query('INSERT INTO hall (name, kind) VALUES ($1,$2) RETURNING *', [name, kind || 'SHARED']);
  return rows[0];
}
async function listSessions({ course_id, group_code, mentor_id } = {}) {
  let sql = 'SELECT * FROM training_session';
  const p = []; const c = [];
  if (course_id) { p.push(course_id); c.push(`course_id = $${p.length}`); }
  if (group_code) { p.push(group_code); c.push(`group_code = $${p.length}`); }
  if (mentor_id) { p.push(mentor_id); c.push(`mentor_id = $${p.length}`); }
  if (c.length) sql += ' WHERE ' + c.join(' AND ');
  sql += ' ORDER BY starts_at ASC';
  const { rows } = await db.query(sql, p);
  return rows;
}
async function getSessionById(id) {
  const { rows } = await db.query('SELECT * FROM training_session WHERE id = $1', [id]);
  return rows[0] || null;
}
async function createSession({ course_id, group_code, title, title_en, title_ar, hall_id, mentor_id, starts_at, ends_at, capacity }) {
  if (!course_id || !group_code || !hall_id || !mentor_id || !starts_at || !ends_at) throw bad('course_id, group_code, hall_id, mentor_id, starts_at, ends_at are required');
  if (new Date(starts_at) >= new Date(ends_at)) throw bad('ends_at must be after starts_at');
  const hallClash = await db.query(
    `SELECT id FROM hall_booking WHERE hall_id = $1 AND starts_at < $3 AND ends_at > $2 LIMIT 1`, [hall_id, starts_at, ends_at]);
  if (hallClash.rows.length) { const e = new Error('Hall is already booked for this time slot'); e.statusCode = 409; e.code = 'CONFLICT'; throw e; }
  const mentorClash = await db.query(
    `SELECT id FROM training_session WHERE mentor_id = $1 AND status <> 'CANCELLED' AND starts_at < $3 AND ends_at > $2 LIMIT 1`, [mentor_id, starts_at, ends_at]);
  if (mentorClash.rows.length) { const e = new Error('Mentor has another session in this time slot'); e.statusCode = 409; e.code = 'CONFLICT'; throw e; }
  const titleVal = title || (title_en || title_ar ? { en: title_en || '', ar: title_ar || '' } : null);
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO training_session (course_id, group_code, title, hall_id, mentor_id, starts_at, ends_at, capacity)
       VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7,$8) RETURNING *`,
      [course_id, group_code, titleVal ? toJson(titleVal) : null, hall_id, mentor_id, starts_at, ends_at, capacity ?? null]);
    await client.query(
      `INSERT INTO hall_booking (hall_id, starts_at, ends_at, source, training_session_id) VALUES ($1,$2,$3,'SESSION',$4)`,
      [hall_id, starts_at, ends_at, rows[0].id]);
    await client.query('COMMIT');
    return rows[0];
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}
async function setSessionStatus(id, status) {
  if (!['PLANNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].includes(status)) throw bad('invalid status');
  const { rows } = await db.query(`UPDATE training_session SET status = $1 WHERE id = $2 RETURNING *`, [status, id]);
  return rows[0] || null;
}

module.exports = { listHalls, createHall, listSessions, getSessionById, createSession, setSessionStatus };
