
-- Add package_type column to students table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS package_type TEXT;

-- Create an index for better performance on package_type lookups
CREATE INDEX IF NOT EXISTS idx_students_package_type ON public.students(package_type);

-- Update existing students to have a default package type (you may want to set this based on your business logic)
UPDATE public.students 
SET package_type = 'Camp Training' 
WHERE package_type IS NULL;
