-- Create enum types
CREATE TYPE public.session_status AS ENUM ('scheduled', 'completed', 'cancelled');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'pending');
CREATE TYPE public.day_of_week AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');

-- Create branches table
CREATE TABLE public.branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  contact_info TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create coaches table
CREATE TABLE public.coaches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create coach availability table
CREATE TABLE public.coach_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID REFERENCES public.coaches(id) ON DELETE CASCADE NOT NULL,
  day_of_week day_of_week NOT NULL,
  UNIQUE(coach_id, day_of_week)
);

-- Create students table
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  sessions INTEGER DEFAULT 0, -- Total sessions purchased (NULL allowed, default 0)
  remaining_sessions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create training sessions table
CREATE TABLE public.training_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  branch_id UUID REFERENCES public.branches(id) NOT NULL,
  coach_id UUID REFERENCES public.coaches(id) NOT NULL,
  notes TEXT,
  status session_status NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create session participants table (many-to-many between sessions and students)
CREATE TABLE public.session_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.training_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(session_id, student_id)
);

-- Create attendance records table
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.training_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  status attendance_status NOT NULL DEFAULT 'pending',
  marked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, student_id)
);

-- Enable Row Level Security
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allowing all operations for now)
CREATE POLICY "Allow all operations on branches" ON public.branches FOR ALL USING (true);
CREATE POLICY "Allow all operations on coaches" ON public.coaches FOR ALL USING (true);
CREATE POLICY "Allow all operations on coach_availability" ON public.coach_availability FOR ALL USING (true);
CREATE POLICY "Allow all operations on students" ON public.students FOR ALL USING (true);
CREATE POLICY "Allow all operations on training_sessions" ON public.training_sessions FOR ALL USING (true);
CREATE POLICY "Allow all operations on session_participants" ON public.session_participants FOR ALL USING (true);
CREATE POLICY "Allow all operations on attendance_records" ON public.attendance_records FOR ALL USING (true);

-- Create function to update remaining sessions when attendance is marked
CREATE OR REPLACE FUNCTION public.update_student_sessions()
RETURNS TRIGGER AS $$
BEGIN
  -- If attendance is being marked as present
  IF NEW.status = 'present' AND (OLD.status IS NULL OR OLD.status != 'present') THEN
    UPDATE public.students 
    SET remaining_sessions = remaining_sessions - 1
    WHERE id = NEW.student_id AND remaining_sessions > 0;
  END IF;
  
  -- If attendance is being changed from present to something else
  IF OLD.status = 'present' AND NEW.status != 'present' THEN
    UPDATE public.students 
    SET remaining_sessions = remaining_sessions + 1
    WHERE id = NEW.student_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for attendance updates
CREATE TRIGGER update_student_sessions_trigger
  AFTER INSERT OR UPDATE ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_student_sessions();

-- Create function to check for scheduling conflicts
CREATE OR REPLACE FUNCTION public.check_scheduling_conflicts(
  p_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_coach_id UUID,
  p_student_ids UUID[],
  p_session_id UUID DEFAULT NULL
)
RETURNS TABLE(conflict_type TEXT, conflict_details TEXT) AS $$
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
$$ LANGUAGE plpgsql;
