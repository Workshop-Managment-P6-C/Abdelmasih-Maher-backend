// Training-domain data access. All queries use PostgreSQL $n placeholders
// and column names from the wst schema (mirrors P6-C compact ERD v3).
const db = require('../config/db');

const toJson = (v) => {
  if (typeof v !== 'string') return JSON.stringify(v);
  try { JSON.parse(v); return v; } catch { return JSON.stringify({ en: v }); }
};

// ---------- Courses ----------
// course(id, code, name jsonb {"en","ar"}, required_sessions)
async function listCourses() {
  const { rows } = await db.query('SELECT * FROM course ORDER BY code ASC');
  return rows;
}
async function getCourseById(id) {
  const { rows } = await db.query('SELECT * FROM course WHERE id = $1', [id]);
  return rows[0] || null;
}
async function createCourse({ code, name, name_en, name_ar, required_sessions }) {
  if (!code) {
    const e = new Error('code is required');
    e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
  }
  const nameVal = name || (name_en || name_ar ? { en: name_en || '', ar: name_ar || '' } : null);
  if (!nameVal) {
    const e = new Error('name (or name_en/name_ar) is required');
    e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
  }
  const { rows } = await db.query(
    'INSERT INTO course (code, name, required_sessions) VALUES ($1, $2::jsonb, $3) RETURNING *',
    [code, toJson(nameVal), required_sessions || null]
  );
  return rows[0];
}
async function updateCourse(id, { code, name, name_en, name_ar, required_sessions }) {
  const nameVal = name || (name_en || name_ar ? { en: name_en, ar: name_ar } : null);
  const { rows } = await db.query(
    `UPDATE course SET code = COALESCE($1, code),
      name = COALESCE($2::jsonb, name),
      required_sessions = COALESCE($3, required_sessions)
     WHERE id = $4 RETURNING *`,
    [code || null, nameVal ? toJson(nameVal) : null, required_sessions ?? null, id]
  );
  return rows[0] || null;
}
async function deleteCourse(id) {
  const { rows } = await db.query('DELETE FROM course WHERE id = $1 RETURNING id', [id]);
  return rows[0] || null;
}

// ---------- Tasks ----------
// practical_task(id, course_id, title, description, competency_code, competency_name jsonb)
async function listTasks(courseId) {
  if (courseId) {
    const { rows } = await db.query('SELECT * FROM practical_task WHERE course_id = $1 ORDER BY title ASC', [courseId]);
    return rows;
  }
  const { rows } = await db.query('SELECT * FROM practical_task ORDER BY title ASC');
  return rows;
}
async function getTaskById(id) {
  const { rows } = await db.query('SELECT * FROM practical_task WHERE id = $1', [id]);
  return rows[0] || null;
}
async function createTask({ course_id, title, description, competency_code, competency_name }) {
  if (!course_id || !title || !competency_code) {
    const e = new Error('course_id, title and competency_code are required');
    e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
  }
  const { rows } = await db.query(
    `INSERT INTO practical_task (course_id, title, description, competency_code, competency_name)
     VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING *`,
    [course_id, title, description || null, competency_code, competency_name ? toJson(competency_name) : null]
  );
  return rows[0];
}
async function updateTask(id, { title, description, competency_code, competency_name }) {
  const { rows } = await db.query(
    `UPDATE practical_task SET title = COALESCE($1, title),
      description = COALESCE($2, description),
      competency_code = COALESCE($3, competency_code),
      competency_name = COALESCE($4::jsonb, competency_name)
     WHERE id = $5 RETURNING *`,
    [title || null, description ?? null, competency_code || null,
     competency_name ? toJson(competency_name) : null, id]
  );
  return rows[0] || null;
}
async function deleteTask(id) {
  const { rows } = await db.query('DELETE FROM practical_task WHERE id = $1 RETURNING id', [id]);
  return rows[0] || null;
}

// ---------- Enrollments ----------
// enrollment(id, student_id, course_id, group_code, enrolled_at) UNIQUE(student_id, course_id)
async function listEnrollments({ student_id, course_id } = {}) {
  let sql = 'SELECT * FROM enrollment';
  const params = [];
  const conds = [];
  if (student_id) { params.push(student_id); conds.push(`student_id = $${params.length}`); }
  if (course_id) { params.push(course_id); conds.push(`course_id = $${params.length}`); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY enrolled_at DESC';
  const { rows } = await db.query(sql, params);
  return rows;
}
async function enrollStudent({ student_id, course_id, group_code }) {
  if (!student_id || !course_id || !group_code) {
    const e = new Error('student_id, course_id and group_code are required');
    e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
  }
  const { rows } = await db.query(
    'INSERT INTO enrollment (student_id, course_id, group_code) VALUES ($1, $2, $3) RETURNING *',
    [student_id, course_id, group_code]
  );
  return rows[0];
}
async function deleteEnrollment(id) {
  const { rows } = await db.query('DELETE FROM enrollment WHERE id = $1 RETURNING id', [id]);
  return rows[0] || null;
}

// ---------- Attendance ----------
// attendance(id, training_session_id, student_id, status, recorded_by, recorded_at)
// status: PRESENT | ABSENT | LATE | EXCUSED ; UNIQUE(training_session_id, student_id)
async function listAttendance({ training_session_id, student_id } = {}) {
  let sql = 'SELECT * FROM attendance';
  const params = [];
  const conds = [];
  if (training_session_id) { params.push(training_session_id); conds.push(`training_session_id = $${params.length}`); }
  if (student_id) { params.push(student_id); conds.push(`student_id = $${params.length}`); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY recorded_at DESC';
  const { rows } = await db.query(sql, params);
  return rows;
}
async function recordAttendance({ training_session_id, session_id, student_id, status, recorded_by }) {
  const sessionId = training_session_id || session_id;
  if (!sessionId || !student_id || !status) {
    const e = new Error('training_session_id, student_id and status are required');
    e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
  }
  const allowed = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
  if (!allowed.includes(status)) {
    const e = new Error(`status must be one of ${allowed.join(', ')}`);
    e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
  }
  const { rows } = await db.query(
    `INSERT INTO attendance (training_session_id, student_id, status, recorded_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (training_session_id, student_id)
     DO UPDATE SET status = EXCLUDED.status, recorded_by = EXCLUDED.recorded_by, recorded_at = NOW()
     RETURNING *`,
    [sessionId, student_id, status, recorded_by || null]
  );
  return rows[0];
}

// ---------- Assessments ----------
// assessment(id, training_session_id, student_id, practical_task_id, result, ...,
//   entered_by, signed_by, signed_at)
async function listAssessments({ student_id, training_session_id } = {}) {
  let sql = 'SELECT * FROM assessment';
  const params = [];
  const conds = [];
  if (student_id) { params.push(student_id); conds.push(`student_id = $${params.length}`); }
  if (training_session_id) { params.push(training_session_id); conds.push(`training_session_id = $${params.length}`); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY training_session_id, student_id';
  const { rows } = await db.query(sql, params);
  return rows;
}
async function createAssessment({ training_session_id, student_id, practical_task_id, result, time_on_task_minutes, mentor_note, entered_by }) {
  if (!training_session_id || !student_id || !practical_task_id || !result || !entered_by) {
    const e = new Error('training_session_id, student_id, practical_task_id, result and entered_by are required');
    e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
  }
  const { rows } = await db.query(
    `INSERT INTO assessment (training_session_id, student_id, practical_task_id, result, time_on_task_minutes, mentor_note, entered_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [training_session_id, student_id, practical_task_id, result, time_on_task_minutes || null, mentor_note || null, entered_by]
  );
  return rows[0];
}
// Supervisor sign-off (WST-FR-11): signer must differ from the mentor who entered it.
async function signAssessment(id, signedBy) {
  if (!signedBy) {
    const e = new Error('signed_by is required'); e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
  }
  const cur = await db.query('SELECT * FROM assessment WHERE id = $1', [id]);
  if (!cur.rows[0]) return null;
  if (cur.rows[0].entered_by === signedBy) {
    const e = new Error('signer must differ from the mentor who entered the result');
    e.statusCode = 422; e.code = 'INVALID_SIGNER'; throw e;
  }
  const { rows } = await db.query(
    `UPDATE assessment SET signed_by = $1, signed_at = NOW() WHERE id = $2 RETURNING *`, [signedBy, id]);
  return rows[0];
}
// Competency coverage (WST-FR-12): signed PASS results vs course tasks.
async function competencyCoverage(studentId, courseId) {
  const { rows } = await db.query(
    `SELECT t.id, t.title, t.competency_code,
      EXISTS (SELECT 1 FROM assessment a WHERE a.practical_task_id = t.id AND a.student_id = $1 AND a.result = 'PASS' AND a.signed_at IS NOT NULL) AS passed_signed
     FROM practical_task t WHERE t.course_id = $2 ORDER BY t.title`, [studentId, courseId]);
  const total = rows.length, done = rows.filter((r) => r.passed_signed).length;
  return { student_id: studentId, course_id: courseId, total, passed_signed: done, complete: total > 0 && done === total, tasks: rows };
}

// ---------- Certificates ----------
// certificate(id, student_id, course_id, token, status, issued_at, revoked_at, revoked_reason)
async function getCertificatesByStudent(studentId) {
  const { rows } = await db.query('SELECT * FROM certificate WHERE student_id = $1 ORDER BY issued_at DESC', [studentId]);
  return rows;
}
async function createCertificate({ student_id, course_id, token }) {
  if (!student_id || !course_id) {
    const e = new Error('student_id and course_id are required');
    e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
  }
  const crypto = require('crypto');
  const tok = token || crypto.randomBytes(24).toString('hex');
  const { rows } = await db.query(
    'INSERT INTO certificate (student_id, course_id, token) VALUES ($1, $2, $3) RETURNING *',
    [student_id, course_id, tok]
  );
  return rows[0];
}
async function verifyCertificate(token) {
  const { rows } = await db.query(
    `SELECT c.*, u.full_name AS student_name FROM certificate c JOIN app_user u ON u.id = c.student_id WHERE c.token = $1`,
    [token]);
  return rows[0] || null;
}
async function revokeCertificate(id, revokedReason) {
  const { rows } = await db.query(
    `UPDATE certificate SET status = 'REVOKED', revoked_at = NOW(), revoked_reason = $1 WHERE id = $2 RETURNING *`,
    [revokedReason || null, id]);
  return rows[0] || null;
}

// ---------- Hall bookings ----------
// hall_booking(id, hall_id, starts_at, ends_at, source, job_card_id, training_session_id)
async function listHallBookings({ hall_id } = {}) {
  if (hall_id) {
    const { rows } = await db.query('SELECT * FROM hall_booking WHERE hall_id = $1 ORDER BY starts_at ASC', [hall_id]);
    return rows;
  }
  const { rows } = await db.query('SELECT * FROM hall_booking ORDER BY starts_at ASC');
  return rows;
}
async function createHallBooking({ hall_id, starts_at, ends_at, training_session_id }) {
  if (!hall_id || !starts_at || !ends_at) {
    const e = new Error('hall_id, starts_at and ends_at are required');
    e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
  }
  // Service-layer overlap guard (MySQL has no exclusion constraint; PG mirror keeps the check in code)
  const { rows: clash } = await db.query(
    `SELECT id FROM hall_booking WHERE hall_id = $1
     AND starts_at < $3 AND ends_at > $2 LIMIT 1`,
    [hall_id, starts_at, ends_at]
  );
  if (clash.length) {
    const e = new Error('Hall is already booked for the requested time slot');
    e.statusCode = 409; e.code = 'CONFLICT'; throw e;
  }
  const { rows } = await db.query(
    `INSERT INTO hall_booking (hall_id, starts_at, ends_at, source, training_session_id)
     VALUES ($1, $2, $3, 'SESSION', $4) RETURNING *`,
    [hall_id, starts_at, ends_at, training_session_id || null]
  );
  return rows[0];
}

module.exports = {
  listCourses, getCourseById, createCourse, updateCourse, deleteCourse,
  listTasks, getTaskById, createTask, updateTask, deleteTask,
  listEnrollments, enrollStudent, deleteEnrollment,
  listAttendance, recordAttendance,
  listAssessments, createAssessment, signAssessment, competencyCoverage,
  getCertificatesByStudent, createCertificate, verifyCertificate, revokeCertificate,
  listHallBookings, createHallBooking,
};
