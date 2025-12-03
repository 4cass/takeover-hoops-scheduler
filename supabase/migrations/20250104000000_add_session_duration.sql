-- Change remaining_sessions from INTEGER to NUMERIC to support decimal values (0.5, 1.5, etc.)
ALTER TABLE public.students 
ALTER COLUMN remaining_sessions TYPE numeric(10, 2) USING remaining_sessions::numeric(10, 2);

-- Add session_duration column to attendance_records table
-- Note: We don't set a default here - the application will set it explicitly
ALTER TABLE public.attendance_records 
ADD COLUMN IF NOT EXISTS session_duration numeric(4, 2);

-- Update the function to deduct sessions based on duration
CREATE OR REPLACE FUNCTION public.update_student_sessions()
RETURNS TRIGGER AS $$
DECLARE
  session_deduction numeric(4, 2);
BEGIN
  -- If attendance is being marked as present
  IF NEW.status = 'present' AND (OLD.status IS NULL OR OLD.status != 'present') THEN
    -- Use the session_duration from NEW (which should be set explicitly)
    -- If it's NULL, default to 1.0, but it should always be set now
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

