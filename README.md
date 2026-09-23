# BUA DevHub — Workshop & Training Backend (P6-C)

Node.js + Express + PostgreSQL. Layers: Routes → Controllers → Services → `db.query` ($n placeholders).

## Quick start
```bash
npm install
# database
createdb -U postgres wst
psql -U wst -d wst -v ON_ERROR_STOP=1 -f db/erd.sql
psql -U wst -d wst -v ON_ERROR_STOP=1 -f db/student_seed.sql
psql -U wst -d wst -v ON_ERROR_STOP=1 -f db/workshop_seed.sql
# (workshop seed includes the people stand-in; use the real people seed instead if you have it)
cp .env.example .env   # adjust DATABASE_URL / JWT_SECRET
npm start               # or npm run dev
```
Health: `GET /api/v1/health` · Docs: `GET /api-docs` (serves `docs/openapi.yaml`, 94 endpoints).

## Key rules enforced in code
- Job stages: RECEIVED → IN_PROGRESS → QUALITY_CHECK → READY → DELIVERED (+ QC→IN_PROGRESS rework); invalid → 422, every change writes `job_stage`.
- Stock ledger append-only; ISSUE blocked when on-hand insufficient (422 INSUFFICIENT_STOCK).
- PO two-approval: `approvals_required = 2` when total > `PO_APPROVAL_THRESHOLD` (default 5000); approver ≠ creator, two approvers differ; stock changes only on goods receipt.
- Invoices computed from uninvoiced labour + ISSUE movements (no hand-typed totals).
- Sessions: hall + mentor overlap guard (409). Assessments: signer ≠ mentor. Certificates: random token + public verify + revoke.
- Errors: `{ error: { code, message, requestId } }`.

## Layout
- `src/routes|controllers|services` — one module per domain (auth, users, customers, vehicles, bays, job-cards, work-items, parts, stock, purchase-orders, invoices, courses, tasks, sessions, enrollments, attendance, assessments, certificates, halls, students, dashboards, exports, predictions, attachments, notifications)
- `src/middlewares` — JWT auth, role authorize, async error wrapper
- `src/config/db.js` — pg Pool
- `db/` — PostgreSQL schema + seeds (ported from MySQL via `convert.js`)
- `docs/openapi.yaml` — 94 endpoints contract (verified by `node swagger.js`)
