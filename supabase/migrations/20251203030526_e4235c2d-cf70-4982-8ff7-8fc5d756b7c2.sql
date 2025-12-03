-- Add RLS policies for branches table to allow admin management

-- Allow admins to insert branches
CREATE POLICY "Admins can insert branches"
ON public.branches
FOR INSERT
WITH CHECK (is_user_admin());

-- Allow admins to update branches
CREATE POLICY "Admins can update branches"
ON public.branches
FOR UPDATE
USING (is_user_admin());

-- Allow admins to delete branches
CREATE POLICY "Admins can delete branches"
ON public.branches
FOR DELETE
USING (is_user_admin());