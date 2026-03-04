-- Migration: Create ticket_snapshots table
-- Run this migration in your Supabase SQL Editor
-- Or use the app's onAppInstall handler to create it automatically

CREATE TABLE IF NOT EXISTS ticket_snapshots (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL,
  subject TEXT,
  requester_email TEXT,
  status TEXT,
  priority INTEGER,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  raw_json JSONB
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ticket_snapshots_ticket_id ON ticket_snapshots(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_snapshots_created_at ON ticket_snapshots(created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_snapshots_status ON ticket_snapshots(status);
CREATE INDEX IF NOT EXISTS idx_ticket_snapshots_requester_email ON ticket_snapshots(requester_email);

-- Optional: Add comment to table
COMMENT ON TABLE ticket_snapshots IS 'Stores ticket snapshots from Freshdesk for SQL reporting and analytics';
