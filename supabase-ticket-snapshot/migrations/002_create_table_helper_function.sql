-- Optional: Create a helper function to execute SQL via REST API
-- This allows the app to create tables programmatically
-- Run this ONCE in your Supabase SQL Editor if you want automatic table creation

CREATE OR REPLACE FUNCTION create_ticket_snapshots_table()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create table if it doesn't exist
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

  -- Create indexes if they don't exist
  CREATE INDEX IF NOT EXISTS idx_ticket_snapshots_ticket_id ON ticket_snapshots(ticket_id);
  CREATE INDEX IF NOT EXISTS idx_ticket_snapshots_created_at ON ticket_snapshots(created_at);
  CREATE INDEX IF NOT EXISTS idx_ticket_snapshots_status ON ticket_snapshots(status);
  CREATE INDEX IF NOT EXISTS idx_ticket_snapshots_requester_email ON ticket_snapshots(requester_email);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_ticket_snapshots_table() TO authenticated;
GRANT EXECUTE ON FUNCTION create_ticket_snapshots_table() TO anon;
