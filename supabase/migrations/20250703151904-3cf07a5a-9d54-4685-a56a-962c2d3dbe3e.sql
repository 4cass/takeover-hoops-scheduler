
-- Remove the coach_id foreign key from students table and add branch_id instead
-- Also remove package_type from students since it will be determined by the session
ALTER TABLE public.students 
DROP COLUMN IF EXISTS coach_id,
DROP COLUMN IF EXISTS package_type,
ADD COLUMN branch_id UUID REFERENCES public.branches(id);

-- Create an index for better performance on branch lookups
CREATE INDEX IF NOT EXISTS idx_students_branch_id ON public.students(branch_id);
