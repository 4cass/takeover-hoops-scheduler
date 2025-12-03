-- This script will fix the remaining_sessions column to support decimal values
-- Run this in your Supabase SQL Editor

-- Step 1: Check current column type (for reference)
-- SELECT column_name, data_type, numeric_precision, numeric_scale 
-- FROM information_schema.columns 
-- WHERE table_name = 'students' AND column_name = 'remaining_sessions';

-- Step 2: Change remaining_sessions from INTEGER to NUMERIC to support decimal values (0.5, 1.5, etc.)
ALTER TABLE public.students 
ALTER COLUMN remaining_sessions TYPE numeric(10, 2) USING remaining_sessions::numeric(10, 2);

-- Step 3: Verify the change
-- SELECT column_name, data_type, numeric_precision, numeric_scale 
-- FROM information_schema.columns 
-- WHERE table_name = 'students' AND column_name = 'remaining_sessions';


