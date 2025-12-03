-- Fix numeric precision and ensure trigger works correctly
-- Run this in your Supabase SQL Editor

-- Step 1: Ensure remaining_sessions has proper precision/scale for decimals
ALTER TABLE public.students 
ALTER COLUMN remaining_sessions TYPE numeric(10, 2) USING remaining_sessions::numeric(10, 2);

-- Step 2: Ensure session_duration has proper precision/scale
ALTER TABLE public.attendance_records 
ALTER COLUMN session_duration TYPE numeric(4, 2) USING COALESCE(session_duration, 1.0)::numeric(4, 2);

-- Step 3: Update the trigger function to ensure it handles decimals correctly
CREATE OR REPLACE FUNCTION public.update_student_sessions()
RETURNS TRIGGER AS $$
DECLARE
  v_session_deduction numeric(4, 2);
BEGIN
  -- If attendance is being marked as present
  IF NEW.status = 'present' AND (OLD.status IS NULL OR OLD.status != 'present') THEN
    -- Use the session_duration from NEW (which should be set explicitly)
    -- Check if session_duration is NULL or 0, if so default to 1.0
    IF NEW.session_duration IS NULL OR NEW.session_duration = 0 THEN
      v_session_deduction := 1.0::numeric(4, 2);
    ELSE
      v_session_deduction := NEW.session_duration::numeric(4, 2);
    END IF;
    
    -- Update remaining_sessions with explicit numeric casting
    UPDATE public.students 
    SET remaining_sessions = GREATEST(0, (remaining_sessions::numeric(10, 2) - v_session_deduction)::numeric(10, 2))
    WHERE id = NEW.student_id;
  END IF;
  
  -- If attendance is being changed from present to something else
  IF OLD.status = 'present' AND NEW.status != 'present' THEN
    -- Get the original session duration that was deducted
    v_session_deduction := COALESCE(OLD.session_duration, 1.0)::numeric(4, 2);
    
    -- Add back the deducted sessions
    UPDATE public.students 
    SET remaining_sessions = (remaining_sessions::numeric(10, 2) + v_session_deduction)::numeric(10, 2)
    WHERE id = NEW.student_id;
  END IF;
  
  -- If changing from one present status to another (updating duration)
  IF OLD.status = 'present' AND NEW.status = 'present' AND 
     (OLD.session_duration IS DISTINCT FROM NEW.session_duration) THEN
    -- Add back the old duration
    v_session_deduction := COALESCE(OLD.session_duration, 1.0)::numeric(4, 2);
    UPDATE public.students 
    SET remaining_sessions = (remaining_sessions::numeric(10, 2) + v_session_deduction)::numeric(10, 2)
    WHERE id = NEW.student_id;
    
    -- Deduct the new duration
    v_session_deduction := COALESCE(NEW.session_duration, 1.0)::numeric(4, 2);
    UPDATE public.students 
    SET remaining_sessions = GREATEST(0, (remaining_sessions::numeric(10, 2) - v_session_deduction)::numeric(10, 2))
    WHERE id = NEW.student_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Verify the column types
SELECT 
    table_name,
    column_name, 
    data_type, 
    numeric_precision, 
    numeric_scale 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('students', 'attendance_records')
  AND column_name IN ('remaining_sessions', 'session_duration')
ORDER BY table_name, column_name;

-- Step 5: Test query to see if decimals are being stored
-- Uncomment to check:
-- SELECT id, name, sessions, remaining_sessions, 
--        (sessions - remaining_sessions) as used_sessions
-- FROM public.students 
-- WHERE remaining_sessions IS NOT NULL
-- ORDER BY updated_at DESC
-- LIMIT 10;

