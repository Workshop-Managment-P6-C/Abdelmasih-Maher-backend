-- =============================================================
-- P6-C compact ERD v3 — PostgreSQL 13+ port (converted from MySQL 8 source)
-- Run with: psql -U <user> -d <db> -v ON_ERROR_STOP=1 -f <this file>
-- =============================================================
-- P6-C compact ERD v0.5, MySQL 8.0.13+ version (26 tables). Training sessions now use halls (hall, hall_booking); workshop jobs keep bays.
-- Fixed vs v2: hall and hall_booking are created before training_session, training_session has hall_id instead of bay_id, no ALTER on missing tables.
-- Load order: this file, then P6-C_student_seed_mysql.sql, then the people seed (P6-C_people_seed_standin_mysql.sql if you do not have the real one), then P6-C_workshop_seed_mysql.sql.
-- Run in MySQL Workbench: File > Open SQL Script, then Query > Execute (lightning icon).
-- Recreates the database p6c_workshop from scratch (drops the old one if it exists).
-- Already have v0.3 with data? Do NOT run this file. Run this instead, then reload the training seed:
--   ALTER TABLE training_session ADD COLUMN title JSONB NULL AFTER group_code;
-- Differences from the PostgreSQL model: ids are UUID with DEFAULT gen_random_uuid(); timestamps are TIMESTAMPTZ (store UTC);
-- jsonb columns are JSONB. MySQL has no exclusion constraints, so bay double-booking must be prevented in the service layer.
-- PostgreSQL port of P6-C compact ERD v3 (from MySQL 8 source).
-- Load order: 1) 
--   3) student seed 4) people seed 5) workshop seed.
DROP TABLE IF EXISTS app_user, vehicle, bay, job_card, job_stage, work_item, labor_entry, bay_booking, part, stock_movement, purchase_order, purchase_order_line, invoice, invoice_line, course, practical_task, hall, training_session, hall_booking, enrollment, attendance, assessment, certificate, attachment, notification, prediction CASCADE;


CREATE TABLE app_user (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) UNIQUE,
  password_hash varchar(255),
  full_name varchar(255) NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('WORKSHOP_MANAGER', 'SERVICE_ADVISOR', 'TECHNICIAN', 'QUALITY_CHECKER', 'STOREKEEPER', 'PROCUREMENT', 'TRAINING_SUPERVISOR', 'MENTOR', 'STUDENT', 'FINANCE_VIEWER', 'AUDITOR', 'CUSTOMER')),
  phone varchar(255),
  contact_preference varchar(255),
  store_code varchar(255),
  student_code varchar(255) UNIQUE,
  specialty varchar(255),
  preferred_language varchar(255) DEFAULT 'en',
  is_synthetic BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE vehicle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  plate_number varchar(255),
  vin varchar(255) UNIQUE,
  make varchar(255),
  model varchar(255),
  year INTEGER,
  current_mileage INTEGER,
  next_service_date date,
  next_service_mileage INTEGER,
  service_interval_km INTEGER,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bay (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) UNIQUE NOT NULL,
  kind varchar(255),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE job_card (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number varchar(255) UNIQUE NOT NULL,
  vehicle_id UUID NOT NULL,
  service_type varchar(255),
  priority varchar(255),
  complaint text,
  mileage_in INTEGER,
  stage TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (stage IN ('RECEIVED', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY', 'DELIVERED')),
  bay_id UUID,
  technician_id UUID,
  advisor_id UUID,
  promised_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_at TIMESTAMPTZ,
  updated_by UUID
);

CREATE TABLE job_stage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id UUID NOT NULL,
  from_stage TEXT CHECK (from_stage IN ('RECEIVED', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY', 'DELIVERED')),
  to_stage TEXT NOT NULL CHECK (to_stage IN ('RECEIVED', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY', 'DELIVERED')),
  changed_by UUID NOT NULL,
  note text,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE work_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id UUID NOT NULL,
  description varchar(255) NOT NULL,
  is_billable BOOLEAN DEFAULT TRUE,
  approval TEXT DEFAULT 'PENDING' CHECK (approval IN ('PENDING', 'APPROVED', 'DECLINED')),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  status varchar(255) DEFAULT 'OPEN'
);

CREATE TABLE labor_entry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id UUID NOT NULL,
  work_item_id UUID,
  technician_id UUID NOT NULL,
  minutes INTEGER NOT NULL,
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  note varchar(255)
);

CREATE TABLE bay_booking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bay_id UUID NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('JOB', 'SESSION')),
  job_card_id UUID,
  training_session_id UUID
);

CREATE TABLE part (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku varchar(255) UNIQUE NOT NULL,
  barcode varchar(255) UNIQUE,
  name JSONB NOT NULL,
  category varchar(255),
  compatible_models JSONB,
  unit varchar(255) DEFAULT 'pcs',
  average_cost numeric(12,2),
  min_level INTEGER DEFAULT 0,
  max_level INTEGER,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE stock_movement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id UUID NOT NULL,
  store_code varchar(255) NOT NULL DEFAULT 'S1',
  type TEXT NOT NULL CHECK (type IN ('RECEIPT', 'ISSUE', 'RESERVATION', 'RELEASE', 'TRANSFER_OUT', 'TRANSFER_IN', 'COUNT_ADJUSTMENT', 'ADJUSTMENT', 'REVERSAL')),
  quantity INTEGER NOT NULL,
  unit_cost numeric(12,2),
  reason varchar(255),
  job_card_id UUID,
  purchase_order_line_id UUID,
  reverses_id UUID,
  counted_quantity INTEGER,
  system_quantity INTEGER,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_order (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number varchar(255) UNIQUE NOT NULL,
  vendor_name varchar(255) NOT NULL,
  vendor_contact_phone varchar(255),
  vendor_contact_email varchar(255),
  status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'REJECTED', 'CANCELLED')),
  total_amount numeric(12,2),
  approvals_required INTEGER DEFAULT 1,
  approval1_by UUID,
  approval1_at TIMESTAMPTZ,
  approval2_by UUID,
  approval2_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ
);

CREATE TABLE purchase_order_line (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL,
  part_id UUID NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price numeric(12,2),
  received_quantity INTEGER DEFAULT 0,
  rejected_quantity INTEGER DEFAULT 0
);

CREATE TABLE invoice (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number varchar(255) UNIQUE NOT NULL,
  job_card_id UUID NOT NULL,
  status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ISSUED', 'PAID', 'VOID')),
  subtotal numeric(12,2),
  discount numeric(12,2) DEFAULT 0,
  tax numeric(12,2) DEFAULT 0,
  total_amount numeric(12,2),
  issued_at TIMESTAMPTZ,
  payment_reference varchar(255),
  paid_amount numeric(12,2),
  paid_at TIMESTAMPTZ
);

CREATE TABLE invoice_line (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('LABOUR', 'PART', 'SUBLET')),
  labor_entry_id UUID,
  stock_movement_id UUID,
  description varchar(255),
  quantity numeric(10,2),
  unit_price numeric(12,2)
);

CREATE TABLE course (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(255) UNIQUE NOT NULL,
  name JSONB NOT NULL,
  required_sessions INTEGER
);

CREATE TABLE practical_task (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL,
  title varchar(255) NOT NULL,
  description text,
  competency_code varchar(255) NOT NULL,
  competency_name JSONB
);

CREATE TABLE hall (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) UNIQUE NOT NULL,
  kind varchar(255),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE training_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL,
  group_code varchar(255) NOT NULL,
  title JSONB,
  hall_id UUID NOT NULL,
  mentor_id UUID NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  capacity INTEGER,
  status TEXT DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'))
);

CREATE TABLE hall_booking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hall_id UUID NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('SESSION')),
  job_card_id UUID,
  training_session_id UUID
);

CREATE TABLE enrollment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  course_id UUID NOT NULL,
  group_code varchar(255) NOT NULL,
  enrolled_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_session_id UUID NOT NULL,
  student_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
  recorded_by UUID NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE assessment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_session_id UUID NOT NULL,
  student_id UUID NOT NULL,
  practical_task_id UUID NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('PASS', 'FAIL', 'NEEDS_IMPROVEMENT')),
  time_on_task_minutes INTEGER,
  mentor_note text,
  entered_by UUID NOT NULL,
  signed_by UUID,
  signed_at TIMESTAMPTZ
);

CREATE TABLE certificate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  course_id UUID NOT NULL,
  token varchar(255) UNIQUE NOT NULL,
  status TEXT DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'REVOKED')),
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_reason varchar(255)
);

CREATE TABLE attachment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type varchar(255) NOT NULL,
  owner_id UUID NOT NULL,
  file_name varchar(255) NOT NULL,
  mime_type varchar(255) NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_key varchar(255) NOT NULL,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type varchar(255),
  body varchar(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE TABLE prediction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind varchar(255) NOT NULL,
  subject_type varchar(255) NOT NULL,
  subject_id UUID NOT NULL,
  inputs JSONB,
  baseline_version varchar(255) NOT NULL,
  output varchar(255),
  explanation text,
  decision varchar(255),
  decided_by UUID,
  outcome varchar(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX enrollment_index_0 ON enrollment (student_id, course_id);

CREATE UNIQUE INDEX attendance_index_1 ON attendance (training_session_id, student_id);

COMMENT ON TABLE app_user IS 'Every person in the system in ONE table: staff, mentors, students and customers (told apart by role; the role also decides which front door, Workshop or Student Training, the user may enter). Purpose: one identity and access record, so RBAC, ownership checks and foreign keys all point to a single place.';

COMMENT ON TABLE vehicle IS 'A customer vehicle. Purpose: keeps vehicle identity, service history and the next-service rule; one customer can own many vehicles.';

COMMENT ON TABLE bay IS 'A physical workshop bay (4 in the demo). Purpose: the workshop resource that jobs book; academy training sessions use halls instead.';

COMMENT ON TABLE job_card IS 'One repair job for one vehicle, from reception to delivery. Purpose: the central record of the workshop workflow; everything billable or measured hangs off it.';

COMMENT ON TABLE job_stage IS 'One row per stage change of a job. Purpose: the auditable stage timeline (who moved the job and when) and the source for turnaround and rework metrics.';

COMMENT ON TABLE work_item IS 'One line of the job work checklist with its customer approval. Purpose: enforces the rule that no billable work starts before approval.';

COMMENT ON TABLE labor_entry IS 'Time a technician logged on a job. Purpose: source for invoice labour lines and for labour-hour and utilisation metrics.';

COMMENT ON TABLE hall IS 'A training hall (4 in the demo). Purpose: the room academy sessions are scheduled in, separate from workshop bays.';

COMMENT ON TABLE hall_booking IS 'Hall calendar for training sessions. Purpose: detect hall conflicts. MySQL: check overlaps in the service.';

COMMENT ON TABLE bay_booking IS 'One shared bay calendar for jobs AND training sessions. Purpose: detect conflicts. PostgreSQL: add an exclusion constraint (btree_gist) on (bay_id, tstzrange(starts_at, ends_at)). MySQL: check overlaps in the service.';

COMMENT ON TABLE part IS 'A spare part in the catalogue. Purpose: identity, cost and reorder levels; quantities are NOT stored here, they come from the ledger.';

COMMENT ON TABLE stock_movement IS 'APPEND-ONLY stock ledger: every receipt, issue, reservation, adjustment, count and reversal. Purpose: on-hand and reserved stock are computed from it, so they always reconcile; a REVERSAL row records who undid what and why.';

COMMENT ON TABLE purchase_order IS 'A purchase order to a vendor. Purpose: controlled replenishment; stores the vendor details and up to two approvals so the two-approval rule is data, not code.';

COMMENT ON TABLE purchase_order_line IS 'One part and quantity on a purchase order. Purpose: what was ordered versus what was accepted or rejected on receipt.';

COMMENT ON TABLE invoice IS 'The bill for a completed job, with its payment reference. Purpose: accounting-lite charges computed from logged labour and issued parts, not typed by hand.';

COMMENT ON TABLE invoice_line IS 'One labour, part or sublet line on an invoice, pointing at its source. Purpose: lets invoice totals be recomputed from source records.';

COMMENT ON TABLE course IS 'A practical training course. Purpose: groups tasks and sessions and defines what completion requires.';

COMMENT ON TABLE practical_task IS 'A practical task in a course and the competency it proves. Purpose: the task library; competency coverage is computed from signed results on these tasks.';

COMMENT ON TABLE training_session IS 'One scheduled class: course, group, session title, hall, mentor and time. Purpose: the unit that is checked for bay and mentor conflicts before it can be published.';

COMMENT ON TABLE enrollment IS 'A student joining a course in a group. Purpose: says who takes which course and which group they belong to.';

COMMENT ON TABLE attendance IS 'One student present, absent, late or excused in one session. Purpose: attendance rate and the training-risk flag.';

COMMENT ON TABLE assessment IS 'A mentor result for one student on one task, then signed by the supervisor. Purpose: the evidence behind competencies and certificates; unsigned rows (signed_at is null) never count.';

COMMENT ON TABLE certificate IS 'A certificate issued after all required signed results are met. Purpose: public verification through a random token, with revocation.';

COMMENT ON TABLE attachment IS 'Metadata for an uploaded file (job photo, assessment evidence). Purpose: the file itself sits in private storage; this row controls who may download it.';

COMMENT ON TABLE notification IS 'A message shown to a user (for example a purchase order awaiting approval). Purpose: communication inside the system.';

COMMENT ON TABLE prediction IS 'One advisory suggestion (reorder quantity or training risk) with its inputs, rule version, explanation and the human decision. Purpose: makes the rule-based baseline explainable and measurable.';

ALTER TABLE vehicle ADD FOREIGN KEY (customer_id) REFERENCES app_user (id);

ALTER TABLE job_card ADD FOREIGN KEY (vehicle_id) REFERENCES vehicle (id);

ALTER TABLE job_card ADD FOREIGN KEY (bay_id) REFERENCES bay (id);

ALTER TABLE job_card ADD FOREIGN KEY (technician_id) REFERENCES app_user (id);

ALTER TABLE job_card ADD FOREIGN KEY (advisor_id) REFERENCES app_user (id);

ALTER TABLE job_card ADD FOREIGN KEY (created_by) REFERENCES app_user (id);

ALTER TABLE job_card ADD FOREIGN KEY (updated_by) REFERENCES app_user (id);

ALTER TABLE job_stage ADD FOREIGN KEY (job_card_id) REFERENCES job_card (id);

ALTER TABLE job_stage ADD FOREIGN KEY (changed_by) REFERENCES app_user (id);

ALTER TABLE work_item ADD FOREIGN KEY (job_card_id) REFERENCES job_card (id);

ALTER TABLE work_item ADD FOREIGN KEY (approved_by) REFERENCES app_user (id);

ALTER TABLE labor_entry ADD FOREIGN KEY (job_card_id) REFERENCES job_card (id);

ALTER TABLE labor_entry ADD FOREIGN KEY (work_item_id) REFERENCES work_item (id);

ALTER TABLE labor_entry ADD FOREIGN KEY (technician_id) REFERENCES app_user (id);

ALTER TABLE bay_booking ADD FOREIGN KEY (bay_id) REFERENCES bay (id);

ALTER TABLE bay_booking ADD FOREIGN KEY (job_card_id) REFERENCES job_card (id);

ALTER TABLE bay_booking ADD FOREIGN KEY (training_session_id) REFERENCES training_session (id);

ALTER TABLE stock_movement ADD FOREIGN KEY (part_id) REFERENCES part (id);

ALTER TABLE stock_movement ADD FOREIGN KEY (job_card_id) REFERENCES job_card (id);

ALTER TABLE stock_movement ADD FOREIGN KEY (purchase_order_line_id) REFERENCES purchase_order_line (id);

ALTER TABLE stock_movement ADD FOREIGN KEY (reverses_id) REFERENCES stock_movement (id);

ALTER TABLE stock_movement ADD FOREIGN KEY (created_by) REFERENCES app_user (id);

ALTER TABLE purchase_order ADD FOREIGN KEY (approval1_by) REFERENCES app_user (id);

ALTER TABLE purchase_order ADD FOREIGN KEY (approval2_by) REFERENCES app_user (id);

ALTER TABLE purchase_order ADD FOREIGN KEY (created_by) REFERENCES app_user (id);

ALTER TABLE purchase_order_line ADD FOREIGN KEY (purchase_order_id) REFERENCES purchase_order (id);

ALTER TABLE purchase_order_line ADD FOREIGN KEY (part_id) REFERENCES part (id);

ALTER TABLE invoice ADD FOREIGN KEY (job_card_id) REFERENCES job_card (id);

ALTER TABLE invoice_line ADD FOREIGN KEY (invoice_id) REFERENCES invoice (id);

ALTER TABLE invoice_line ADD FOREIGN KEY (labor_entry_id) REFERENCES labor_entry (id);

ALTER TABLE invoice_line ADD FOREIGN KEY (stock_movement_id) REFERENCES stock_movement (id);

ALTER TABLE practical_task ADD FOREIGN KEY (course_id) REFERENCES course (id);

ALTER TABLE training_session ADD FOREIGN KEY (course_id) REFERENCES course (id);

ALTER TABLE training_session ADD FOREIGN KEY (hall_id) REFERENCES hall (id);

ALTER TABLE hall_booking ADD FOREIGN KEY (hall_id) REFERENCES hall (id);

ALTER TABLE hall_booking ADD FOREIGN KEY (training_session_id) REFERENCES training_session (id);

ALTER TABLE training_session ADD FOREIGN KEY (mentor_id) REFERENCES app_user (id);

ALTER TABLE enrollment ADD FOREIGN KEY (student_id) REFERENCES app_user (id);

ALTER TABLE enrollment ADD FOREIGN KEY (course_id) REFERENCES course (id);

ALTER TABLE attendance ADD FOREIGN KEY (training_session_id) REFERENCES training_session (id);

ALTER TABLE attendance ADD FOREIGN KEY (student_id) REFERENCES app_user (id);

ALTER TABLE attendance ADD FOREIGN KEY (recorded_by) REFERENCES app_user (id);

ALTER TABLE assessment ADD FOREIGN KEY (training_session_id) REFERENCES training_session (id);

ALTER TABLE assessment ADD FOREIGN KEY (student_id) REFERENCES app_user (id);

ALTER TABLE assessment ADD FOREIGN KEY (practical_task_id) REFERENCES practical_task (id);

ALTER TABLE assessment ADD FOREIGN KEY (entered_by) REFERENCES app_user (id);

ALTER TABLE assessment ADD FOREIGN KEY (signed_by) REFERENCES app_user (id);

ALTER TABLE certificate ADD FOREIGN KEY (student_id) REFERENCES app_user (id);

ALTER TABLE certificate ADD FOREIGN KEY (course_id) REFERENCES course (id);

ALTER TABLE attachment ADD FOREIGN KEY (uploaded_by) REFERENCES app_user (id);

ALTER TABLE notification ADD FOREIGN KEY (user_id) REFERENCES app_user (id);

ALTER TABLE prediction ADD FOREIGN KEY (decided_by) REFERENCES app_user (id);
