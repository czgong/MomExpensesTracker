# Database Migration: Adding created_at to expenses table

## Issue
The expenses table was missing a `created_at` timestamp column, so we couldn't track when expenses were added to the system.

## Solution
Add a `created_at` column to the expenses table and update the server code to use it.

## Steps to Apply Migration

### Option 1: Run via Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Execute this SQL:

```sql
-- Add created_at column to expenses table
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Update existing expenses to have a created_at timestamp
UPDATE public.expenses 
SET created_at = timezone('utc'::text, now()) 
WHERE created_at IS NULL;
```

### Option 2: Use the Migration Script
```bash
cd server
node run-migration.js
```

## Verification
After running the migration, test it:

```bash
cd server
node test-created-at.js
```

## What Changed

### Database Schema
- Added `created_at` column to `expenses` table
- Column has a default value of current UTC timestamp
- Existing expenses get a timestamp when migration runs

### Server Code (`server.js`)
- POST `/api/data` now explicitly sets `created_at` when creating expenses
- GET `/api/data` now orders by `created_at` (newest first)
- All expense responses include the `created_at` field

### Frontend Code
- Updated data processing to include `created_at` field
- Added timestamp display in both card and table views
- Shows "Added" time using the existing `formatTimestamp` function

## Benefits
- ✅ Track when each expense was created
- ✅ Better debugging and audit trail
- ✅ Sort expenses by creation time vs expense date
- ✅ Enhanced user experience with timestamp info