-- Create coach_attendance_records table
-- This table tracks attendance for coaches assigned to training sessions
CREATE TABLE IF NOT EXISTS public.coach_attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.training_sessions(id) ON DELETE CASCADE NOT NULL,
  coach_id UUID REFERENCES public.coaches(id) ON DELETE CASCADE NOT NULL,
  status attendance_status NOT NULL DEFAULT 'pending',
  marked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, coach_id)
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_coach_attendance_session_id ON public.coach_attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_coach_attendance_coach_id ON public.coach_attendance_records(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_attendance_status ON public.coach_attendance_records(status);

-- Enable Row Level Security
ALTER TABLE public.coach_attendance_records ENABLE ROW LEVEL SECURITY;

-- Create RLS policy (allowing all operations for now)
CREATE POLICY "Allow all operations on coach_attendance_records" 
ON public.coach_attendance_records 
FOR ALL 
USING (true);

-- Create function to automatically mark coaches as absent after 1 hour grace period
-- This function checks if a coach hasn't been marked as present within 1 hour of session start time
CREATE OR REPLACE FUNCTION public.check_coach_attendance_grace_period()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  session_record RECORD;
  session_start_datetime TIMESTAMP WITH TIME ZONE;
  grace_period_end TIMESTAMP WITH TIME ZONE;
  v_current_time TIMESTAMP WITH TIME ZONE;
BEGIN
  v_current_time := NOW();
  
  -- Loop through all sessions that have coaches assigned but haven't been marked as present/absent
  FOR session_record IN
    SELECT 
      ts.id as session_id,
      ts.date,
      ts.start_time,
      sc.coach_id
    FROM public.training_sessions ts
    INNER JOIN public.session_coaches sc ON ts.id = sc.session_id
    LEFT JOIN public.coach_attendance_records car 
      ON ts.id = car.session_id 
      AND sc.coach_id = car.coach_id
    WHERE 
      -- Only check sessions that are scheduled or completed (not cancelled)
      ts.status IN ('scheduled', 'completed')
      -- Only check sessions where attendance is still pending or doesn't exist
      AND (car.status IS NULL OR car.status = 'pending')
      -- Only check sessions that have started (date + start_time has passed)
      AND (ts.date + ts.start_time) <= v_current_time
  LOOP
    -- Calculate session start datetime
    session_start_datetime := (session_record.date + session_record.start_time);
    
    -- Calculate grace period end (1 hour after session start)
    grace_period_end := session_start_datetime + INTERVAL '1 hour';
    
    -- If grace period has passed and attendance is still pending, mark as absent
    IF v_current_time > grace_period_end THEN
      -- Insert or update coach attendance record as absent
      INSERT INTO public.coach_attendance_records (
        session_id,
        coach_id,
        status,
        marked_at,
        updated_at
      )
      VALUES (
        session_record.session_id,
        session_record.coach_id,
        'absent',
        v_current_time,
        v_current_time
      )
      ON CONFLICT (session_id, coach_id)
      DO UPDATE SET
        status = 'absent',
        marked_at = v_current_time,
        updated_at = v_current_time
      WHERE coach_attendance_records.status = 'pending';
    END IF;
  END LOOP;
END;
$$;

-- Create a function that can be called periodically (via cron job or scheduled task)
-- to automatically mark coaches as absent after grace period
CREATE OR REPLACE FUNCTION public.auto_mark_coach_absent_after_grace_period()
RETURNS TABLE(
  marked_absent_count INTEGER,
  sessions_checked INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  marked_count INTEGER := 0;
  checked_count INTEGER := 0;
  session_record RECORD;
  session_start_datetime TIMESTAMP WITH TIME ZONE;
  grace_period_end TIMESTAMP WITH TIME ZONE;
  v_current_time TIMESTAMP WITH TIME ZONE;
BEGIN
  v_current_time := NOW();
  checked_count := 0;
  marked_count := 0;
  
  -- Loop through all sessions that need checking
  FOR session_record IN
    SELECT 
      ts.id as session_id,
      ts.date,
      ts.start_time,
      sc.coach_id,
      car.id as attendance_id,
      car.status as current_status
    FROM public.training_sessions ts
    INNER JOIN public.session_coaches sc ON ts.id = sc.session_id
    LEFT JOIN public.coach_attendance_records car 
      ON ts.id = car.session_id 
      AND sc.coach_id = car.coach_id
    WHERE 
      -- Only check sessions that are scheduled or completed (not cancelled)
      ts.status IN ('scheduled', 'completed')
      -- Only check sessions where attendance is still pending or doesn't exist
      AND (car.status IS NULL OR car.status = 'pending')
      -- Only check sessions that have started (date + start_time has passed)
      AND (ts.date + ts.start_time) <= v_current_time
  LOOP
    checked_count := checked_count + 1;
    
    -- Calculate session start datetime
    session_start_datetime := (session_record.date + session_record.start_time);
    
    -- Calculate grace period end (1 hour after session start)
    grace_period_end := session_start_datetime + INTERVAL '1 hour';
    
    -- If grace period has passed and attendance is still pending, mark as absent
    IF v_current_time > grace_period_end THEN
      -- Insert or update coach attendance record as absent
      INSERT INTO public.coach_attendance_records (
        session_id,
        coach_id,
        status,
        marked_at,
        updated_at
      )
      VALUES (
        session_record.session_id,
        session_record.coach_id,
        'absent',
        v_current_time,
        v_current_time
      )
      ON CONFLICT (session_id, coach_id)
      DO UPDATE SET
        status = 'absent',
        marked_at = v_current_time,
        updated_at = v_current_time
      WHERE coach_attendance_records.status = 'pending';
      
      -- Count how many were marked
      IF FOUND THEN
        marked_count := marked_count + 1;
      END IF;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT marked_count, checked_count;
END;
$$;

-- Create a trigger function that automatically creates pending attendance records
-- when a coach is assigned to a session (via session_coaches)
CREATE OR REPLACE FUNCTION public.create_coach_attendance_on_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create a pending attendance record when a coach is assigned to a session
  INSERT INTO public.coach_attendance_records (
    session_id,
    coach_id,
    status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.session_id,
    NEW.coach_id,
    'pending',
    NOW(),
    NOW()
  )
  ON CONFLICT (session_id, coach_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically create attendance records when coaches are assigned
CREATE TRIGGER create_coach_attendance_on_assignment_trigger
  AFTER INSERT ON public.session_coaches
  FOR EACH ROW
  EXECUTE FUNCTION public.create_coach_attendance_on_assignment();

-- Create a function to manually mark coach attendance (can be called from application)
CREATE OR REPLACE FUNCTION public.mark_coach_attendance(
  p_session_id UUID,
  p_coach_id UUID,
  p_status attendance_status
)
RETURNS public.coach_attendance_records
LANGUAGE plpgsql
AS $$
DECLARE
  result_record public.coach_attendance_records;
  session_record RECORD;
  session_start_datetime TIMESTAMP WITH TIME ZONE;
  grace_period_end TIMESTAMP WITH TIME ZONE;
  v_current_time TIMESTAMP WITH TIME ZONE;
BEGIN
  v_current_time := NOW();
  
  -- Get session details
  SELECT date, start_time INTO session_record
  FROM public.training_sessions
  WHERE id = p_session_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  
  -- Calculate session start datetime
  session_start_datetime := (session_record.date + session_record.start_time);
  
  -- Calculate grace period end (1 hour after session start)
  grace_period_end := session_start_datetime + INTERVAL '1 hour';
  
  -- If trying to mark as present after grace period, still allow it (manual override)
  -- But if trying to mark as absent before grace period ends, check if it's valid
  
  -- Insert or update attendance record
  INSERT INTO public.coach_attendance_records (
    session_id,
    coach_id,
    status,
    marked_at,
    updated_at
  )
  VALUES (
    p_session_id,
    p_coach_id,
    p_status,
    v_current_time,
    v_current_time
  )
  ON CONFLICT (session_id, coach_id)
  DO UPDATE SET
    status = p_status,
    marked_at = v_current_time,
    updated_at = v_current_time
  RETURNING * INTO result_record;
  
  RETURN result_record;
END;
$$;

-- Add comment to table
COMMENT ON TABLE public.coach_attendance_records IS 'Tracks attendance for coaches assigned to training sessions. Coaches have a 1-hour grace period from session start time before being automatically marked as absent.';

-- Add comments to columns
COMMENT ON COLUMN public.coach_attendance_records.status IS 'Attendance status: pending (default), present, or absent. Automatically set to absent after 1 hour grace period.';
COMMENT ON COLUMN public.coach_attendance_records.marked_at IS 'Timestamp when attendance was manually marked or automatically set to absent.';

