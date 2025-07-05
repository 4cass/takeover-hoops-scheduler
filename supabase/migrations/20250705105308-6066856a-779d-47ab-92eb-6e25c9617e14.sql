
-- Remove the single coach_id foreign key constraint from training_sessions
ALTER TABLE public.training_sessions DROP CONSTRAINT IF EXISTS training_sessions_coach_id_fkey;

-- Drop the coach_id column from training_sessions since we'll use a junction table
ALTER TABLE public.training_sessions DROP COLUMN coach_id;

-- Create a junction table for session coaches (many-to-many relationship)
CREATE TABLE public.session_coaches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, coach_id)
);

-- Enable RLS on the new table
ALTER TABLE public.session_coaches ENABLE ROW LEVEL SECURITY;

-- Create policy for session_coaches
CREATE POLICY "Allow all operations on session_coaches" 
ON public.session_coaches 
FOR ALL 
USING (true);

-- Update the check_scheduling_conflicts function to work with the new structure
CREATE OR REPLACE FUNCTION public.check_scheduling_conflicts(
  p_date date, 
  p_start_time time without time zone, 
  p_end_time time without time zone, 
  p_coach_ids uuid[], 
  p_student_ids uuid[], 
  p_session_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(conflict_type text, conflict_details text)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check coach conflicts
  FOR i IN 1..array_length(p_coach_ids, 1) LOOP
    IF EXISTS (
      SELECT 1 FROM public.training_sessions ts
      JOIN public.session_coaches sc ON ts.id = sc.session_id
      WHERE ts.date = p_date
      AND sc.coach_id = p_coach_ids[i]
      AND ts.status != 'cancelled'
      AND (p_session_id IS NULL OR ts.id != p_session_id)
      AND (
        (p_start_time >= ts.start_time AND p_start_time < ts.end_time) OR
        (p_end_time > ts.start_time AND p_end_time <= ts.end_time) OR
        (p_start_time <= ts.start_time AND p_end_time >= ts.end_time)
      )
    ) THEN
      RETURN QUERY SELECT 'coach'::TEXT, 
        ('Coach ' || (SELECT name FROM public.coaches WHERE id = p_coach_ids[i]) || ' is already scheduled at this time')::TEXT;
    END IF;
  END LOOP;

  -- Check student conflicts (unchanged)
  FOR i IN 1..array_length(p_student_ids, 1) LOOP
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
