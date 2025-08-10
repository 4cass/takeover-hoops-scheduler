-- Enable RLS on tables that need it
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Create policies for coaches to manage students
CREATE POLICY "Coaches can view all students" 
ON public.students 
FOR SELECT 
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.coaches 
  WHERE coaches.auth_id = auth.uid() 
  AND coaches.role IN ('admin', 'coach')
));

CREATE POLICY "Coaches can insert students" 
ON public.students 
FOR INSERT 
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.coaches 
  WHERE coaches.auth_id = auth.uid() 
  AND coaches.role IN ('admin', 'coach')
));

CREATE POLICY "Coaches can update students" 
ON public.students 
FOR UPDATE 
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.coaches 
  WHERE coaches.auth_id = auth.uid() 
  AND coaches.role IN ('admin', 'coach')
));

CREATE POLICY "Coaches can delete students" 
ON public.students 
FOR DELETE 
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.coaches 
  WHERE coaches.auth_id = auth.uid() 
  AND coaches.role = 'admin'
));

-- Create policies for coaches to manage sessions they are assigned to
CREATE POLICY "Coaches can insert sessions they are assigned to" 
ON public.training_sessions 
FOR INSERT 
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.coaches 
  WHERE coaches.auth_id = auth.uid() 
  AND coaches.role IN ('admin', 'coach')
));

CREATE POLICY "Coaches can update sessions they are assigned to" 
ON public.training_sessions 
FOR UPDATE 
TO authenticated
USING (
  -- Admin can update all sessions
  (EXISTS (
    SELECT 1 FROM public.coaches 
    WHERE coaches.auth_id = auth.uid() 
    AND coaches.role = 'admin'
  ))
  OR
  -- Coach can update sessions they are assigned to
  (EXISTS (
    SELECT 1 FROM public.session_coaches sc
    JOIN public.coaches c ON sc.coach_id = c.id
    WHERE sc.session_id = training_sessions.id 
    AND c.auth_id = auth.uid()
  ))
);

CREATE POLICY "Coaches can delete sessions they are assigned to" 
ON public.training_sessions 
FOR DELETE 
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.coaches 
  WHERE coaches.auth_id = auth.uid() 
  AND coaches.role = 'admin'
));

-- Create policies for branches access
CREATE POLICY "Coaches can view branches" 
ON public.branches 
FOR SELECT 
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.coaches 
  WHERE coaches.auth_id = auth.uid() 
  AND coaches.role IN ('admin', 'coach')
));

-- Create policies for coaches table
CREATE POLICY "Coaches can view all coaches" 
ON public.coaches 
FOR SELECT 
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.coaches 
  WHERE coaches.auth_id = auth.uid() 
  AND coaches.role IN ('admin', 'coach')
));

-- Create policies for session_coaches table
CREATE POLICY "Coaches can view session assignments" 
ON public.session_coaches 
FOR SELECT 
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.coaches 
  WHERE coaches.auth_id = auth.uid() 
  AND coaches.role IN ('admin', 'coach')
));

CREATE POLICY "Coaches can manage session assignments" 
ON public.session_coaches 
FOR ALL 
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.coaches 
  WHERE coaches.auth_id = auth.uid() 
  AND coaches.role IN ('admin', 'coach')
));

-- Create policies for session_participants table
CREATE POLICY "Coaches can view session participants" 
ON public.session_participants 
FOR SELECT 
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.coaches 
  WHERE coaches.auth_id = auth.uid() 
  AND coaches.role IN ('admin', 'coach')
));

CREATE POLICY "Coaches can manage session participants" 
ON public.session_participants 
FOR ALL 
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.coaches 
  WHERE coaches.auth_id = auth.uid() 
  AND coaches.role IN ('admin', 'coach')
));

-- Create policies for attendance_records table
CREATE POLICY "Coaches can view attendance records" 
ON public.attendance_records 
FOR SELECT 
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.coaches 
  WHERE coaches.auth_id = auth.uid() 
  AND coaches.role IN ('admin', 'coach')
));

CREATE POLICY "Coaches can manage attendance records" 
ON public.attendance_records 
FOR ALL 
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.coaches 
  WHERE coaches.auth_id = auth.uid() 
  AND coaches.role IN ('admin', 'coach')
));