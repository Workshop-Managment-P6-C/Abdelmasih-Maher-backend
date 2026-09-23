const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '1h';

function signTokens(user) {
  const payload = { userId: user.id, email: user.email, role: user.role };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  // Stateless refresh placeholder (opaque random token could be persisted later)
  const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

// Schema: app_user(id uuid, email, password_hash, full_name, role, phone,
//   contact_preference, store_code, student_code, specialty, preferred_language,
//   is_synthetic, is_active, is_archived, created_at, updated_at)
const PUBLIC_COLUMNS = 'id, email, full_name, role, phone, store_code, student_code, specialty, preferred_language, is_active, created_at';

const login = async (email, password) => {
  if (!email || !password) {
    const e = new Error('Email and password are required');
    e.statusCode = 400;
    e.code = 'VALIDATION_ERROR';
    throw e;
  }
  const { rows } = await db.query('SELECT * FROM app_user WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || !user.password_hash) {
    const e = new Error('Invalid email or password');
    e.statusCode = 401;
    e.code = 'UNAUTHORIZED';
    throw e;
  }
  let ok = false;
  try {
    ok = await bcrypt.compare(password, user.password_hash);
  } catch (_) {
    ok = false;
  }
  // Fallback for legacy plaintext seeds (never used for new users)
  if (!ok && user.password_hash === password) ok = true;
  if (!ok) {
    const e = new Error('Invalid email or password');
    e.statusCode = 401;
    e.code = 'UNAUTHORIZED';
    throw e;
  }
  if (user.is_active === false) {
    const e = new Error('User account is disabled');
    e.statusCode = 403;
    e.code = 'FORBIDDEN';
    throw e;
  }
  const { password_hash, ...safe } = user;
  return { ...signTokens(user), user: safe };
};

const register = async ({ full_name, name, email, password }) => {
  const displayName = full_name || name;
  if (!displayName || !email || !password) {
    const e = new Error('full_name, email and password are required');
    e.statusCode = 400;
    e.code = 'VALIDATION_ERROR';
    throw e;
  }
  const { rows: existing } = await db.query('SELECT id FROM app_user WHERE email = $1', [email]);
  if (existing.length) {
    const e = new Error('Email already registered');
    e.statusCode = 409;
    e.code = 'CONFLICT';
    throw e;
  }
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await db.query(
    `INSERT INTO app_user (full_name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${PUBLIC_COLUMNS}`,
    [displayName, email, hash, 'STUDENT']
  );
  return rows[0];
};

const findUserByEmail = async (email) => {
  const { rows } = await db.query(`SELECT ${PUBLIC_COLUMNS} FROM app_user WHERE email = $1`, [email]);
  return rows[0] || null;
};

const getAllUsers = async () => {
  const { rows } = await db.query(`SELECT ${PUBLIC_COLUMNS} FROM app_user ORDER BY created_at DESC`);
  return rows;
};

const getUserById = async (id) => {
  const { rows } = await db.query(`SELECT ${PUBLIC_COLUMNS} FROM app_user WHERE id = $1`, [id]);
  return rows[0] || null;
};

const updateUser = async (id, { full_name, name, email, role, phone, preferred_language, is_active }) => {
  const current = await getUserById(id);
  if (!current) return null;
  const allowedRoles = [
    'WORKSHOP_MANAGER', 'SERVICE_ADVISOR', 'TECHNICIAN', 'QUALITY_CHECKER',
    'STOREKEEPER', 'PROCUREMENT', 'TRAINING_SUPERVISOR', 'MENTOR', 'STUDENT',
    'FINANCE_VIEWER', 'AUDITOR', 'CUSTOMER',
  ];
  if (role && !allowedRoles.includes(role)) {
    const e = new Error('Invalid role');
    e.statusCode = 400;
    e.code = 'VALIDATION_ERROR';
    throw e;
  }
  const { rows } = await db.query(
    `UPDATE app_user
     SET full_name = COALESCE($1, full_name),
         email = COALESCE($2, email),
         role = COALESCE($3, role),
         phone = COALESCE($4, phone),
         preferred_language = COALESCE($5, preferred_language),
         is_active = COALESCE($6, is_active),
         updated_at = NOW()
     WHERE id = $7
     RETURNING ${PUBLIC_COLUMNS}`,
    [full_name || name || null, email || null, role || null, phone || null, preferred_language || null,
     typeof is_active === 'boolean' ? is_active : null, id]
  );
  return rows[0] || null;
};

const deleteUser = async (id) => {
  // Soft-delete to preserve FK history (assessments, attendance, jobs...)
  const { rows } = await db.query(
    `UPDATE app_user SET is_active = false, is_archived = true, updated_at = NOW()
     WHERE id = $1 RETURNING id`,
    [id]
  );
  return rows[0] || null;
};

module.exports = {
  login,
  register,
  findUserByEmail,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  signTokens,
};
