
-- Create table for coach time tracking
CREATE TABLE public.coach_session_times (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  time_in timestamp with time zone,
  time_out timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(session_id, coach_id)
);

-- Create table for activity logs
CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  user_type text NOT NULL CHECK (user_type IN ('coach', 'admin')),
  session_id uuid NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN ('time_in', 'time_out', 'session_completed')),
  activity_description text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.coach_session_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for coach_session_times
CREATE POLICY "Coaches can view their own time records" 
  ON public.coach_session_times 
  FOR SELECT 
  USING (
    coach_id IN (
      SELECT id FROM coaches WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can insert their own time records" 
  ON public.coach_session_times 
  FOR INSERT 
  WITH CHECK (
    coach_id IN (
      SELECT id FROM coaches WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can update their own time records" 
  ON public.coach_session_times 
  FOR UPDATE 
  USING (
    coach_id IN (
      SELECT id FROM coaches WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all time records" 
  ON public.coach_session_times 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM coaches 
      WHERE auth_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS policies for activity_logs
CREATE POLICY "Users can view their own activity logs" 
  ON public.activity_logs 
  FOR SELECT 
  USING (
    user_id IN (
      SELECT id FROM coaches WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own activity logs" 
  ON public.activity_logs 
  FOR INSERT 
  WITH CHECK (
    user_id IN (
      SELECT id FROM coaches WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all activity logs" 
  ON public.activity_logs 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM coaches 
      WHERE auth_id = auth.uid() AND role = 'admin'
    )
  );

-- Function to automatically update session status when coach times out
CREATE OR REPLACE FUNCTION update_session_status_on_timeout()
RETURNS TRIGGER AS $$
BEGIN
  -- Update session status to completed when time_out is set
  IF NEW.time_out IS NOT NULL AND (OLD.time_out IS NULL OR OLD.time_out != NEW.time_out) THEN
    UPDATE training_sessions 
    SET status = 'completed', updated_at = now() 
    WHERE id = NEW.session_id;
    
    -- Insert activity log for session completion
    INSERT INTO activity_logs (
      user_id, 
      user_type, 
      session_id, 
      activity_type, 
      activity_description
    ) VALUES (
      NEW.coach_id,
      'coach',
      NEW.session_id,
      'session_completed',
      'Session marked as completed'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for session status update
CREATE TRIGGER trigger_update_session_status
  AFTER UPDATE ON coach_session_times
  FOR EACH ROW
  EXECUTE FUNCTION update_session_status_on_timeout();
