-- Complete fix for session duration deduction
-- This will fix the trigger and correct existing incorrect data
-- Run this ENTIRE script in your Supabase SQL Editor

-- Step 1: Ensure column types are correct
ALTER TABLE public.students 
ALTER COLUMN remaining_sessions TYPE numeric(10, 2) USING remaining_sessions::numeric(10, 2);

ALTER TABLE public.attendance_records 
ALTER COLUMN session_duration TYPE numeric(4, 2) USING COALESCE(session_duration, 1.0)::numeric(4, 2);

-- Step 2: Drop the existing trigger to ensure clean recreation
DROP TRIGGER IF EXISTS update_student_sessions_trigger ON public.attendance_records;

-- Step 3: Create the updated trigger function with proper decimal handling
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

-- Step 4: Recreate the trigger
CREATE TRIGGER update_student_sessions_trigger
  AFTER INSERT OR UPDATE ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_student_sessions();

-- Step 5: Fix existing incorrect data
-- This recalculates remaining_sessions based on actual session_duration values
WITH attendance_summary AS (
  SELECT 
    s.id as student_id,
    s.sessions as total_sessions,
    COALESCE(SUM(ar.session_duration), 0)::numeric(10, 2) as total_used_sessions
  FROM public.students s
  LEFT JOIN public.attendance_records ar ON s.id = ar.student_id AND ar.status = 'present'
  GROUP BY s.id, s.sessions
)
UPDATE public.students s
SET remaining_sessions = GREATEST(0, (attendance_summary.total_sessions::numeric(10, 2) - attendance_summary.total_used_sessions)::numeric(10, 2))
FROM attendance_summary
WHERE s.id = attendance_summary.student_id;

-- Step 6: Verify the fix
SELECT 
    'Column Types' as check_type,
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

-- Step 7: Show corrected data
SELECT 
    s.name as student_name,
    s.sessions as total_sessions,
    s.remaining_sessions,
    COUNT(ar.id) as attendance_count,
    COALESCE(SUM(ar.session_duration), 0)::numeric(10, 2) as total_used_sessions,
    (s.sessions::numeric(10, 2) - COALESCE(SUM(ar.session_duration), 0)::numeric(10, 2)) as calculated_remaining
FROM public.students s
LEFT JOIN public.attendance_records ar ON s.id = ar.student_id AND ar.status = 'present'
GROUP BY s.id, s.name, s.sessions, s.remaining_sessions
ORDER BY s.name
LIMIT 10;

