-- ============================================================
-- Freshdesk → Supabase Ticket Snapshot App
-- Migration: create the ticket_snapshots table
--
-- Run this script once in your Supabase project:
--   Dashboard → SQL Editor → paste → Run
--
-- The default table name is "ticket_snapshots".
-- If you changed the table_name iparam, replace every
-- occurrence of "ticket_snapshots" below with your chosen name.
-- ============================================================

-- 1. Table -------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_snapshots (

    -- Auto-increment surrogate key
    id              BIGSERIAL       PRIMARY KEY,

    -- Freshdesk ticket identifier (not unique: re-syncs are appended)
    ticket_id       BIGINT          NOT NULL,

    -- Core fields mapped from the onTicketCreate payload
    subject         TEXT,
    requester_email TEXT,
    status          TEXT,           -- human-readable: Open, Pending, Resolved…
    priority        TEXT,           -- human-readable: Low, Medium, High, Urgent

    -- Tags stored as a native PostgreSQL text array.
    -- Query: WHERE 'billing' = ANY(tags)
    tags            TEXT[],

    -- Freshdesk created_at timestamp (ISO-8601 / timestamptz)
    created_at      TIMESTAMPTZ,

    -- Full payload snapshot for ad-hoc exploration
    raw_json        JSONB,

    -- Timestamp when this row was written by the app
    synced_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()

);

-- 2. Indexes -----------------------------------------------------

-- Fast lookups by Freshdesk ticket ID
CREATE INDEX IF NOT EXISTS idx_ts_ticket_id
    ON ticket_snapshots (ticket_id);

-- Reporting / filtering by status
CREATE INDEX IF NOT EXISTS idx_ts_status
    ON ticket_snapshots (status);

-- Reporting / filtering by priority
CREATE INDEX IF NOT EXISTS idx_ts_priority
    ON ticket_snapshots (priority);

-- Time-range queries on ticket creation date
CREATE INDEX IF NOT EXISTS idx_ts_created_at
    ON ticket_snapshots (created_at DESC);

-- GIN index for efficient tag array queries
CREATE INDEX IF NOT EXISTS idx_ts_tags
    ON ticket_snapshots USING GIN (tags);

-- GIN index for JSONB field querying
CREATE INDEX IF NOT EXISTS idx_ts_raw_json
    ON ticket_snapshots USING GIN (raw_json);

-- 3. Permissions -------------------------------------------------
-- Grant to the roles your API key belongs to.
-- service_role can bypass RLS; anon is used with anon keys.

GRANT SELECT, INSERT ON ticket_snapshots TO service_role;
GRANT USAGE, SELECT ON SEQUENCE ticket_snapshots_id_seq TO service_role;

GRANT SELECT, INSERT ON ticket_snapshots TO anon;
GRANT USAGE, SELECT ON SEQUENCE ticket_snapshots_id_seq TO anon;

-- 4. Row Level Security (optional) --------------------------------
-- Uncomment if you want to restrict reads via RLS policies.
-- With a service_role key the app bypasses RLS automatically.
--
-- ALTER TABLE ticket_snapshots ENABLE ROW LEVEL SECURITY;
--
-- -- Allow the service role (used by the app) to insert
-- CREATE POLICY "service_role_all"
--   ON ticket_snapshots FOR ALL
--   USING (true)
--   WITH CHECK (true);


-- ============================================================
-- Sample queries for reporting
-- ============================================================

-- Open ticket count by priority
-- SELECT priority, COUNT(*) AS total
-- FROM ticket_snapshots
-- WHERE status = 'Open'
-- GROUP BY priority
-- ORDER BY total DESC;

-- Recent tickets (last 7 days)
-- SELECT ticket_id, subject, requester_email, status, priority
-- FROM ticket_snapshots
-- WHERE created_at >= NOW() - INTERVAL '7 days'
-- ORDER BY created_at DESC;

-- Tickets containing a specific tag
-- SELECT ticket_id, subject, tags
-- FROM ticket_snapshots
-- WHERE 'billing' = ANY(tags);

-- Daily volume for last 30 days
-- SELECT DATE(created_at) AS day, COUNT(*) AS tickets
-- FROM ticket_snapshots
-- WHERE created_at >= NOW() - INTERVAL '30 days'
-- GROUP BY day
-- ORDER BY day;

-- Explore a specific ticket's raw payload
-- SELECT raw_json
-- FROM ticket_snapshots
-- WHERE ticket_id = 1042
-- LIMIT 1;
