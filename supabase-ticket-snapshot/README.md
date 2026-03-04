# Supabase Ticket Snapshot App

A Freshworks Platform 3.0 serverless app that automatically stores ticket snapshots in Supabase for SQL-based reporting and analysis.

## Features

- ✅ Automatically captures ticket data on ticket creation
- ✅ Stores ticket snapshots in Supabase PostgreSQL database
- ✅ Supports SQL-based reporting and analytics
- ✅ Minimal configuration (URL + API key)
- ✅ Predictable schema for easy querying

## Installation

### Prerequisites

1. A Supabase project (free tier works)
2. Supabase API key (anon key or service role key)
3. Freshdesk account with app installation permissions

### Step 1: Database Setup (Choose One Method)

The app will attempt to create the table automatically on installation. However, you have two options:

#### Option A: Automatic Table Creation (Recommended)

1. **Create the helper function** (run once in Supabase SQL Editor):
   - Open `migrations/002_create_table_helper_function.sql` in the app directory
   - Copy and run the SQL in your Supabase SQL Editor
   - This creates a function that allows the app to create tables automatically

2. **Install the app** - The app will automatically create the table on installation

#### Option B: Manual Table Creation

If you prefer to create the table manually:

1. Open `migrations/001_create_ticket_snapshots_table.sql` in the app directory
2. Copy the SQL migration script
3. Run it in your Supabase SQL Editor

**Note:** If you want to use a different table name, replace `ticket_snapshots` with your preferred name in the migration SQL and configure it in the app installation parameters.

### Step 2: Get Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy your **Project URL** hostname (e.g., `xxxxx.supabase.co`)
4. Copy your **anon key** or **service role key**
   - Use **anon key** for basic operations (recommended)
   - Use **service role key** if you need bypass RLS (Row Level Security)

### Step 3: Install the App

1. Install the app in your Freshdesk account
2. Configure the installation parameters:
   - **Supabase Project Host**: Your Supabase hostname (e.g., `xxxxx.supabase.co`)
   - **Supabase API Key**: Your anon key or service role key
   - **Table Name**: Name of the table (default: `ticket_snapshots`)

3. **On installation**, the app will:
   - Check if the table exists
   - Attempt to create it automatically (if helper function is set up)
   - Provide clear instructions if manual migration is needed

## Migrations

The app includes migration scripts in the `migrations/` directory:

- **`001_create_ticket_snapshots_table.sql`** - Creates the table and indexes (run manually)
- **`002_create_table_helper_function.sql`** - Creates a helper function for automatic table creation (optional, run once)

### Migration Workflow

1. **First-time setup**: Run `001_create_ticket_snapshots_table.sql` in Supabase SQL Editor
2. **For automatic creation**: Run `002_create_table_helper_function.sql` first, then the app can create tables automatically
3. **Custom table names**: Modify the migration SQL to use your preferred table name

## Schema

The app stores the following ticket data:

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Auto-incrementing primary key |
| `ticket_id` | BIGINT | Freshdesk ticket ID |
| `subject` | TEXT | Ticket subject |
| `requester_email` | TEXT | Requester's email address |
| `status` | TEXT | Ticket status (e.g., "Open", "Pending", "Resolved") |
| `priority` | INTEGER | Ticket priority (1-4) |
| `tags` | TEXT[] | Array of ticket tags |
| `created_at` | TIMESTAMPTZ | Timestamp when snapshot was created |
| `raw_json` | JSONB | Complete ticket object as JSON |

## Usage

Once installed, the app automatically:
- Captures ticket data whenever a new ticket is created
- Stores the snapshot in your Supabase database
- Includes the full ticket object in `raw_json` for detailed analysis

## SQL Reporting Examples

### Count tickets by status

```sql
SELECT status, COUNT(*) as count
FROM ticket_snapshots
GROUP BY status
ORDER BY count DESC;
```

### Tickets by requester

```sql
SELECT requester_email, COUNT(*) as ticket_count
FROM ticket_snapshots
GROUP BY requester_email
ORDER BY ticket_count DESC
LIMIT 10;
```

### Recent tickets with high priority

```sql
SELECT ticket_id, subject, requester_email, status, priority, created_at
FROM ticket_snapshots
WHERE priority >= 3
ORDER BY created_at DESC
LIMIT 20;
```

### Tickets with specific tags

```sql
SELECT ticket_id, subject, tags, created_at
FROM ticket_snapshots
WHERE 'urgent' = ANY(tags)
ORDER BY created_at DESC;
```

### Access raw ticket data

```sql
SELECT ticket_id, raw_json->>'description' as description, raw_json->>'type' as type
FROM ticket_snapshots
WHERE raw_json->>'type' = 'Question';
```

## Development

### Running Locally

```bash
cd supabase-ticket-snapshot
fdk run
```

### Validation

```bash
fdk validate
```

## Troubleshooting

### Table doesn't exist error

- Ensure you've created the table in Supabase before installing the app
- Check that the table name in installation parameters matches the actual table name
- Verify you have the correct permissions on the table

### Authentication errors

- Verify your Supabase API key is correct
- Ensure you're using the correct hostname (without `https://`)
- Check that your API key has the necessary permissions

### Data not appearing

- Check the app logs in Freshworks for any error messages
- Verify the table name matches your configuration
- Ensure Row Level Security (RLS) policies allow inserts if enabled

## License

This app is provided as-is for use with Freshworks Platform 3.0.
