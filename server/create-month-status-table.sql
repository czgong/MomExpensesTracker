-- Create month_status table to track month completion
-- This is Phase 1 of the month completion feature implementation

-- Create the month_status table
CREATE TABLE IF NOT EXISTS public.month_status (
    id SERIAL PRIMARY KEY,
    month_key TEXT NOT NULL UNIQUE,
    is_completed BOOLEAN DEFAULT FALSE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add index on month_key for faster lookups
CREATE INDEX IF NOT EXISTS idx_month_status_month_key ON public.month_status(month_key);

-- Add index on is_completed for filtering
CREATE INDEX IF NOT EXISTS idx_month_status_is_completed ON public.month_status(is_completed);

-- Enable RLS (Row Level Security) for security
ALTER TABLE public.month_status ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your auth requirements)
CREATE POLICY "Allow all operations on month_status" ON public.month_status
    FOR ALL
    USING (true)
    WITH CHECK (true);
