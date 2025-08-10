-- Drop the problematic policies first
DROP POLICY IF EXISTS "Coaches can view all coaches" ON public.coaches;
DROP POLICY IF EXISTS "Coaches can view session assignments" ON public.session_coaches;
DROP POLICY IF EXISTS "Coaches can manage session assignments" ON public.session_coaches;
DROP POLICY IF EXISTS "Coaches can view session participants" ON public.session_participants;
DROP POLICY IF EXISTS "Coaches can manage session participants" ON public.session_participants;
DROP POLICY IF EXISTS "Coaches can view all students" ON public.students;
DROP POLICY IF EXISTS "Coaches can insert students" ON public.students;
DROP POLICY IF EXISTS "Coaches can update students" ON public.students;
DROP POLICY IF EXISTS "Coaches can delete students" ON public.students;
DROP POLICY IF EXISTS "Coaches can insert sessions they are assigned to" ON public.training_sessions;
DROP POLICY IF EXISTS "Coaches can update sessions they are assigned to" ON public.training_sessions;
DROP POLICY IF EXISTS "Coaches can delete sessions they are assigned to" ON public.training_sessions;
DROP POLICY IF EXISTS "Coaches can view branches" ON public.branches;
DROP POLICY IF EXISTS "Coaches can view attendance records" ON public.attendance_records;
DROP POLICY IF EXISTS "Coaches can manage attendance records" ON public.attendance_records;

-- Create security definer functions to avoid recursion
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.coaches WHERE auth_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_current_coach_id()
RETURNS UUID AS $$
  SELECT id FROM public.coaches WHERE auth_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_user_coach_or_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coaches 
    WHERE auth_id = auth.uid() 
    AND role IN ('admin', 'coach')
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coaches 
    WHERE auth_id = auth.uid() 
    AND role = 'admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- Create new policies using security definer functions
CREATE POLICY "Coaches can view all coaches" 
ON public.coaches 
FOR SELECT 
TO authenticated
USING (public.is_user_coach_or_admin());

CREATE POLICY "Coaches can view all students" 
ON public.students 
FOR SELECT 
TO authenticated
USING (public.is_user_coach_or_admin());

CREATE POLICY "Coaches can insert students" 
ON public.students 
FOR INSERT 
TO authenticated
WITH CHECK (public.is_user_coach_or_admin());

CREATE POLICY "Coaches can update students" 
ON public.students 
FOR UPDATE 
TO authenticated
USING (public.is_user_coach_or_admin());

CREATE POLICY "Coaches can delete students" 
ON public.students 
FOR DELETE 
TO authenticated
USING (public.is_user_admin());

CREATE POLICY "Coaches can insert sessions" 
ON public.training_sessions 
FOR INSERT 
TO authenticated
WITH CHECK (public.is_user_coach_or_admin());

CREATE POLICY "Coaches can update sessions they are assigned to" 
ON public.training_sessions 
FOR UPDATE 
TO authenticated
USING (
  public.is_user_admin() OR
  EXISTS (
    SELECT 1 FROM public.session_coaches sc
    WHERE sc.session_id = training_sessions.id 
    AND sc.coach_id = public.get_current_coach_id()
  )
);

CREATE POLICY "Coaches can delete sessions" 
ON public.training_sessions 
FOR DELETE 
TO authenticated
USING (public.is_user_admin());

CREATE POLICY "Coaches can view branches" 
ON public.branches 
FOR SELECT 
TO authenticated
USING (public.is_user_coach_or_admin());

CREATE POLICY "Coaches can view session assignments" 
ON public.session_coaches 
FOR SELECT 
TO authenticated
USING (public.is_user_coach_or_admin());

CREATE POLICY "Coaches can manage session assignments" 
ON public.session_coaches 
FOR ALL 
TO authenticated
USING (public.is_user_coach_or_admin());

CREATE POLICY "Coaches can view session participants" 
ON public.session_participants 
FOR SELECT 
TO authenticated
USING (public.is_user_coach_or_admin());

CREATE POLICY "Coaches can manage session participants" 
ON public.session_participants 
FOR ALL 
TO authenticated
USING (public.is_user_coach_or_admin());

CREATE POLICY "Coaches can view attendance records" 
ON public.attendance_records 
FOR SELECT 
TO authenticated
USING (public.is_user_coach_or_admin());

CREATE POLICY "Coaches can manage attendance records" 
ON public.attendance_records 
FOR ALL 
TO authenticated
USING (public.is_user_coach_or_admin());