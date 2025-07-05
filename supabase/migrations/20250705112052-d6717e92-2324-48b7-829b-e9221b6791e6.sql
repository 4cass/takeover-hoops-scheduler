
-- Drop the session_coaches table
DROP TABLE IF EXISTS public.session_coaches;

-- Add back the coach_id column to training_sessions
ALTER TABLE public.training_sessions ADD COLUMN coach_id UUID;

-- Add back the foreign key constraint
ALTER TABLE public.training_sessions 
ADD CONSTRAINT training_sessions_coach_id_fkey 
FOREIGN KEY (coach_id) REFERENCES public.coaches(id);

-- Restore the original check_scheduling_conflicts function for single coach
CREATE OR REPLACE FUNCTION public.check_scheduling_conflicts(
  p_date date, 
  p_start_time time without time zone, 
  p_end_time time without time zone, 
  p_coach_id uuid, 
  p_student_ids uuid[], 
  p_session_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(conflict_type text, conflict_details text)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check coach conflicts
  IF EXISTS (
    SELECT 1 FROM public.training_sessions ts
    WHERE ts.date = p_date
    AND ts.coach_id = p_coach_id
    AND ts.status != 'cancelled'
    AND (p_session_id IS NULL OR ts.id != p_session_id)
    AND (
      (p_start_time >= ts.start_time AND p_start_time < ts.end_time) OR
      (p_end_time > ts.start_time AND p_end_time <= ts.end_time) OR
      (p_start_time <= ts.start_time AND p_end_time >= ts.end_time)
    )
  ) THEN
    RETURN QUERY SELECT 'coach'::TEXT, 'Coach is already scheduled at this time'::TEXT;
  END IF;

  -- Check student conflicts
  FOR i in 1..array_length(p_student_ids, 1) LOOP
    IF EXISTS (
      SELECT 1 FROM public.training_sessions ts
      JOIN public.session_participants sp ON ts.id = sp.session_id
      WHERE ts.date = p_date
      AND sp.student_id = p_student_ids[i]
      AND ts.status != 'cancelled'
      AND (p_session_id IS NULL OR ts.id != p_session_id)
      AND (
        (p_start_time >= ts.start_time AND p_start_time < ts.end_time) OR
        (p_end_time > ts.start_time AND p_end_time <= ts.end_time) OR
        (p_start_time <= ts.start_time AND p_end_time >= ts.end_time)
      )
    ) THEN
      RETURN QUERY SELECT 'student'::TEXT, 
        ('Student ' || (SELECT name FROM public.students WHERE id = p_student_ids[i]) || ' is already scheduled at this time')::TEXT;
    END IF;
  END LOOP;
END;
$$;
