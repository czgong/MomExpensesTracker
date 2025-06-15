-- Add created_at column to expenses table
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Update existing expenses to have a created_at timestamp if they don't have one
-- This sets all existing expenses to have a created_at timestamp of when this migration runs
UPDATE public.expenses 
SET created_at = timezone('utc'::text, now()) 
WHERE created_at IS NULL;