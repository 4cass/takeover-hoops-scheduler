-- Add RLS policies for admins to manage coaches
CREATE POLICY "Admins can insert coaches" 
ON public.coaches 
FOR INSERT 
WITH CHECK (is_user_admin());

CREATE POLICY "Admins can update coaches" 
ON public.coaches 
FOR UPDATE 
USING (is_user_admin());

CREATE POLICY "Admins can delete coaches" 
ON public.coaches 
FOR DELETE 
USING (is_user_admin());