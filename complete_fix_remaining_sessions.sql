-- Complete fix for remaining_sessions to support decimal values
-- Run this entire script in your Supabase SQL Editor

-- Step 1: Check current column type
SELECT 
    column_name, 
    data_type, 
    numeric_precision, 
    numeric_scale 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'students' 
  AND column_name = 'remaining_sessions';

-- Step 2: Change remaining_sessions from INTEGER to NUMERIC (if needed)
-- This will allow storing decimal values like 3.5
ALTER TABLE public.students 
ALTER COLUMN remaining_sessions TYPE numeric(10, 2) USING remaining_sessions::numeric(10, 2);

-- Step 3: Verify the change
SELECT 
    column_name, 
    data_type, 
    numeric_precision, 
    numeric_scale 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'students' 
  AND column_name = 'remaining_sessions';
-- Should now show: data_type = 'numeric', numeric_precision = 10, numeric_scale = 2

-- Step 4: Update the trigger function to use session_duration
CREATE OR REPLACE FUNCTION public.update_student_sessions()
RETURNS TRIGGER AS $$
DECLARE
  session_deduction numeric(4, 2);
BEGIN
  -- If attendance is being marked as present
  IF NEW.status = 'present' AND (OLD.status IS NULL OR OLD.status != 'present') THEN
    -- Use the session_duration from NEW (which should be set explicitly)
    session_deduction := COALESCE(NEW.session_duration, 1.0);
    
    UPDATE public.students 
    SET remaining_sessions = GREATEST(0, remaining_sessions - session_deduction)
    WHERE id = NEW.student_id AND remaining_sessions >= 0;
  END IF;
  
  -- If attendance is being changed from present to something else
  IF OLD.status = 'present' AND NEW.status != 'present' THEN
    -- Get the original session duration that was deducted
    session_deduction := COALESCE(OLD.session_duration, 1.0);
    
    UPDATE public.students 
    SET remaining_sessions = remaining_sessions + session_deduction
    WHERE id = NEW.student_id;
  END IF;
  
  -- If changing from one present status to another (updating duration)
  IF OLD.status = 'present' AND NEW.status = 'present' AND 
     (OLD.session_duration IS DISTINCT FROM NEW.session_duration) THEN
    -- Add back the old duration
    session_deduction := COALESCE(OLD.session_duration, 1.0);
    UPDATE public.students 
    SET remaining_sessions = remaining_sessions + session_deduction
    WHERE id = NEW.student_id;
    
    -- Deduct the new duration
    session_deduction := COALESCE(NEW.session_duration, 1.0);
    UPDATE public.students 
    SET remaining_sessions = GREATEST(0, remaining_sessions - session_deduction)
    WHERE id = NEW.student_id AND remaining_sessions >= 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Check a sample student to see if they have decimal values
-- Uncomment the line below to see actual values:
-- SELECT id, name, sessions, remaining_sessions, (sessions - remaining_sessions) as used_sessions FROM public.students WHERE remaining_sessions IS NOT NULL LIMIT 5;


