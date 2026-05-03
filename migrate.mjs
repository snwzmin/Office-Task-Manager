import pg from "pg";

const { Client } = pg;

const SQL = `
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM (
    'not_started', 'in_progress', 'waiting_for_response',
    'deferred', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reminder_option AS ENUM (
    'none', 'on_due', '15min_before', '1hr_before',
    '2hr_before', '1day_before', 'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE action_type AS ENUM (
    'created', 'assigned', 'status_changed', 'priority_changed',
    'due_date_changed', 'comment_added', 'attachment_uploaded',
    'reminder_sent', 'completed', 'archived', 'restored', 'edited'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  role           user_role NOT NULL DEFAULT 'user',
  department     TEXT,
  avatar_url     TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT NOT NULL DEFAULT '#2563eb',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id                       TEXT PRIMARY KEY,
  title                    TEXT NOT NULL,
  description              TEXT,
  category_id              TEXT REFERENCES categories(id) ON DELETE SET NULL,
  reference_number         TEXT,
  source_department        TEXT,
  assigned_to              TEXT REFERENCES users(email) ON DELETE SET NULL,
  assigned_to_name         TEXT,
  created_by               TEXT NOT NULL REFERENCES users(email) ON DELETE RESTRICT,
  created_by_name          TEXT NOT NULL,
  priority                 task_priority NOT NULL DEFAULT 'medium',
  status                   task_status NOT NULL DEFAULT 'not_started',
  start_date               TEXT,
  due_date                 TEXT NOT NULL,
  due_time                 TEXT,
  reminder_option          reminder_option NOT NULL DEFAULT 'none',
  custom_reminder_datetime TEXT,
  tags                     TEXT,
  is_archived              BOOLEAN NOT NULL DEFAULT false,
  completed_at             TEXT,
  reminder_sent            BOOLEAN NOT NULL DEFAULT false,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_comments (
  id           TEXT PRIMARY KEY,
  task_id      TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_email   TEXT NOT NULL,
  user_name    TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_attachments (
  id                TEXT PRIMARY KEY,
  task_id           TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name         TEXT NOT NULL,
  stored_filename   TEXT,
  file_url          TEXT NOT NULL,
  file_type         TEXT NOT NULL,
  file_size         TEXT,
  uploaded_by_email TEXT NOT NULL,
  uploaded_by_name  TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE task_attachments ADD COLUMN IF NOT EXISTS stored_filename TEXT;

CREATE TABLE IF NOT EXISTS task_activity_logs (
  id             TEXT PRIMARY KEY,
  task_id        TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_email     TEXT NOT NULL,
  user_name      TEXT NOT NULL,
  action_type    action_type NOT NULL,
  action_details TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reminder_logs (
  id                 TEXT PRIMARY KEY,
  task_id            TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_email         TEXT NOT NULL,
  reminder_type      TEXT NOT NULL,
  reminder_datetime  TEXT NOT NULL,
  email_sent         BOOLEAN NOT NULL DEFAULT false,
  sent_at            TEXT,
  error_message      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query(SQL);
    console.log("[migrate] Schema applied successfully.");
  } finally {
    await client.end();
  }
}

migrate().catch((err) => {
  console.error("[migrate] Error:", err.message);
  process.exit(1);
});
