// MySQL -> PostgreSQL converter for the 3 P6-C files.
const fs = require('fs');
const path = require('path');

const DL = 'C:/Users/Royal/Downloads';
const ERD_MY = path.join(DL, 'P6-C_compact_ERD_v3_mysql (1).sql');
const STU_MY = path.join(DL, 'P6-C_student_seed_mysql (1).sql');
const WSH_MY = path.join(DL, 'P6-C_workshop_seed_mysql (1).sql');

const BOOL_COLS = {
  app_user: ['is_synthetic', 'is_active', 'is_archived'],
  vehicle: ['is_archived'],
  bay: ['is_active'],
  hall: ['is_active'],
  part: ['is_active'],
  work_item: ['is_billable'],
};

const TABLES_26 = ['app_user', 'vehicle', 'bay', 'job_card', 'job_stage', 'work_item',
  'labor_entry', 'bay_booking', 'part', 'stock_movement', 'purchase_order',
  'purchase_order_line', 'invoice', 'invoice_line', 'course', 'practical_task',
  'hall', 'training_session', 'hall_booking', 'enrollment', 'attendance',
  'assessment', 'certificate', 'attachment', 'notification', 'prediction'];

function stripLineComments(sql) {
  return sql.split('\n').filter((ln) => {
    const t = ln.trim();
    if (/^(SET\s|USE\s)/i.test(t)) return false;
    return true;
  }).join('\n');
}

function convertDDL(sql) {
  // drop/create database -> PG header (run connected to target db)
  sql = sql.replace(/DROP DATABASE IF EXISTS\s+`?\w+`?;/gi,
    `-- PostgreSQL port of P6-C compact ERD v3 (from MySQL 8 source).\n-- Load order: 1) create database wst 2) run this file in wst;\n--   3) student seed 4) people seed 5) workshop seed.\nDROP TABLE IF EXISTS ${TABLES_26.join(', ')} CASCADE;`);
  sql = sql.replace(/CREATE DATABASE\s+[^;]+;/gi, '');
  sql = sql.replace(/^\s*USE\s+\w+\s*;/gim, '');
  sql = sql.replace(/`/g, '');
  // DEFAULT (UUID()) -> gen_random_uuid() (built-in since PG13)
  sql = sql.replace(/DEFAULT\s+\(UUID\(\)\)/gi, 'DEFAULT gen_random_uuid()');
  sql = sql.replace(/\bCHAR\(36\)/gi, 'UUID');
  sql = sql.replace(/\bDATETIME\b/gi, 'TIMESTAMPTZ');
  sql = sql.replace(/DEFAULT\s+\(NOW\(\)\)/gi, 'DEFAULT NOW()');
  sql = sql.replace(/\bJSON\b/gi, 'JSONB');
  sql = sql.replace(/\bboolean\s+DEFAULT\s+true\b/gi, 'BOOLEAN DEFAULT TRUE');
  sql = sql.replace(/\bboolean\s+DEFAULT\s+false\b/gi, 'BOOLEAN DEFAULT FALSE');
  // strip inline column COMMENT '...'
  sql = sql.replace(/\s+COMMENT\s+'((?:''|[^'])*)'/gi, '');
  // ENUM col -> TEXT + CHECK (line based)
  sql = sql.split('\n').map((ln) => {
    const m = ln.match(/^(\s*)(\w+)\s+ENUM\s*\((.*?)\)\s*(.*?)(,?)\s*$/i);
    if (!m || !/ENUM/i.test(ln)) return ln;
    const [, indent, col, vals, rest] = m;
    const r = (rest || '').trim().replace(/,$/, '');
    const hadComma = /,\s*$/.test(ln);
    return `${indent}${col} TEXT${r ? ' ' + r : ''} CHECK (${col} IN (${vals}))${hadComma ? ',' : ''}`;
  }).join('\n');
  // fix double commas possibly left
  sql = sql.replace(/,\s*,/g, ',');
  // ALTER TABLE x COMMENT = '...' -> COMMENT ON TABLE
  sql = sql.replace(/ALTER TABLE\s+(\w+)\s+COMMENT\s*=\s*'((?:''|[^'])*)';/gi,
    'COMMENT ON TABLE $1 IS \'$2\';');
  // normalize int
  sql = sql.replace(/\bint\b/gi, 'INTEGER');
  return sql;
}

// Split top-level statements by ';' respecting single-quoted strings and -- comments.
function splitStatements(sql) {
  const out = [];
  let cur = '', inStr = false, inLineComment = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inLineComment) { cur += ch; if (ch === '\n') inLineComment = false; continue; }
    if (!inStr && ch === '-' && sql[i + 1] === '-') { inLineComment = true; cur += ch; continue; }
    if (ch === "'" && !inStr) { inStr = true; cur += ch; continue; }
    if (ch === "'" && inStr) {
      if (sql[i + 1] === "'") { cur += "''"; i++; continue; }
      inStr = false; cur += ch; continue;
    }
    if (ch === ';' && !inStr) { out.push(cur + ';'); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

// Tokenize one (...) tuple: returns array of raw value strings.
function tokenizeTuple(inner) {
  const vals = [];
  let cur = '', inStr = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "'" && !inStr) { inStr = true; cur += ch; continue; }
    if (ch === "'" && inStr) {
      if (inner[i + 1] === "'") { cur += "''"; i++; continue; }
      inStr = false; cur += ch; continue;
    }
    if (ch === ',' && !inStr) { vals.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  vals.push(cur.trim());
  return vals;
}

function convertSeed(sql, { moveBayBookingFirst = false } = {}) {
  sql = stripLineComments(sql);
  sql = sql.replace(/`/g, '');
  // INSERT IGNORE -> plain INSERT (add ON CONFLICT later per statement)
  const stmts = splitStatements(sql);
  const out = [];
  for (let st of stmts) {
    let m = st.match(/^\s*((?:--[^\n]*\n\s*)*)INSERT\s+(IGNORE\s+)?INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*([\s\S]*);\s*$/i);
    if (!m) { out.push(st); continue; }
    const [, comment = '', ignore, table, collist, valuesPart] = m;
    const cols = collist.split(',').map(c => c.trim().replace(/"/g, '').toLowerCase());
    const boolIdx = new Set((BOOL_COLS[table.toLowerCase()] || []).map(c => cols.indexOf(c)).filter(i => i >= 0));
    // find each (...) tuple at depth 0 (skip the subselect parens inside? subselects appear INSIDE tuples: (SELECT ...). Our tokenizer splits tuples by paren depth tracking strings.
    const tuples = [];
    let depth = 0, start = -1, inStr = false;
    const vp = valuesPart.trim();
    for (let i = 0; i < vp.length; i++) {
      const ch = vp[i];
      if (ch === "'" && !inStr) { inStr = true; continue; }
      if (ch === "'" && inStr) { if (vp[i + 1] === "'") { i++; continue; } inStr = false; continue; }
      if (inStr) continue;
      if (ch === '(' && depth === 0) { depth = 1; start = i; continue; }
      if (ch === '(') { depth++; continue; }
      if (ch === ')') {
        depth--;
        if (depth === 0 && start >= 0) { tuples.push(vp.slice(start, i + 1)); start = -1; }
        continue;
      }
      if (ch === ',' && depth === 0) continue; // separator between tuples
    }
    const fixed = tuples.map((t) => {
      const inner = t.slice(1, -1);
      // tuple containing a sub-SELECT: leave untouched (no bare booleans there except none)
      if (/\(\s*SELECT\s/i.test(inner)) return t;
      const vals = tokenizeTuple(inner);
      boolIdx.forEach((idx) => {
        if (vals[idx] === '1') vals[idx] = 'TRUE';
        else if (vals[idx] === '0') vals[idx] = 'FALSE';
      });
      return '(' + vals.join(', ') + ')';
    });
    let rebuilt = `${comment}INSERT INTO ${table} (${collist}) VALUES\n${fixed.join(',\n')};`;
    if (ignore) {
      // hall / bay have UNIQUE(name)
      rebuilt = rebuilt.replace(/;$/, '\nON CONFLICT (name) DO NOTHING;');
    } else if (table.toLowerCase() === 'app_user') {
      // people stand-in rows use deterministic ids -> make re-runs safe
      rebuilt = rebuilt.replace(/;$/, '\nON CONFLICT (id) DO NOTHING;');
    } else {
      // every seed table has PK id -> re-runs skip existing rows
      rebuilt = rebuilt.replace(/;$/, '\nON CONFLICT (id) DO NOTHING;');
    }
    out.push(rebuilt);
  }
  let result = out.join('\n');
  // boolean literal in DELETE filter (e.g. is_synthetic = 1)
  result = result.replace(/\bis_synthetic\s*=\s*1\b/g, 'is_synthetic = TRUE');
  result = result.replace(/\bis_synthetic\s*=\s*0\b/g, 'is_synthetic = FALSE');
  if (moveBayBookingFirst) {
    const lines = result.split('\n');
    // move the bay_booking DELETE statement to the top of deletes: simplest - string move
    const marker = 'DELETE FROM bay_booking WHERE source = \'JOB\';';
    if (result.includes(marker)) {
      result = result.replace(marker + '\n', '');
      result = result.replace(/(SET session_replication_role[^\n]*\n|)(DELETE FROM invoice_line;)/,
        `$1${marker}\n$2`);
    }
  }
  return result;
}

function header(kind) {
  return `-- =============================================================\n-- P6-C ${kind} — PostgreSQL 13+ port (converted from MySQL 8 source)\n-- Run with: psql -U <user> -d <db> -v ON_ERROR_STOP=1 -f <this file>\n-- =============================================================\n`;
}

// ---- ERD ----
let erd = fs.readFileSync(ERD_MY, 'utf8');
erd = convertDDL(erd);
erd = header('compact ERD v3') + erd;
fs.writeFileSync(path.join(DL, 'P6-C_compact_ERD_v3_postgres.sql'), erd);

// ---- Student seed ----
let stu = fs.readFileSync(STU_MY, 'utf8');
stu = convertSeed(stu);
stu = header('student training seed (synthetic data)') +
  `-- Replaces training data only. Load AFTER the ERD schema file.\n` + stu;
fs.writeFileSync(path.join(DL, 'P6-C_student_seed_postgres.sql'), stu);

// ---- Workshop seed ----
let wsh = fs.readFileSync(WSH_MY, 'utf8');
wsh = convertSeed(wsh, { moveBayBookingFirst: true });
wsh = header('workshop seed (synthetic data)') +
  `-- Replaces workshop data only. Load AFTER: ERD + student seed + people seed\n-- (staff, customers and bays referenced by vehicles/jobs must already exist).\n` + wsh;
fs.writeFileSync(path.join(DL, 'P6-C_workshop_seed_postgres.sql'), wsh);

console.log('WROTE_OK');
// sanity: no MySQL remnants
for (const f of ['P6-C_compact_ERD_v3_postgres.sql', 'P6-C_student_seed_postgres.sql', 'P6-C_workshop_seed_postgres.sql']) {
  const s = fs.readFileSync(path.join(DL, f), 'utf8');
  const bad = [];
  if (s.includes('`')) bad.push('backtick');
  if (/\bENUM\s*\(/i.test(s)) bad.push('ENUM');
  if (/\bDATETIME\b/i.test(s)) bad.push('DATETIME');
  if (/FOREIGN_KEY_CHECKS|SET NAMES|client_encoding/i.test(s)) bad.push('mysql-set');
  if (/UUID\(\)/i.test(s)) bad.push('UUID()');
  if (/INSERT\s+IGNORE/i.test(s)) bad.push('INSERT IGNORE');
  if (/CHAR\(36\)/i.test(s)) bad.push('CHAR(36)');
  if (/\bJSONB?B\b/.test(s)) bad.push('json-check');
  console.log(f, s.length, bad.length ? 'REMAIN: ' + bad.join(',') : 'CLEAN');
}
