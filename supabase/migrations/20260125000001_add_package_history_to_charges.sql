-- Add package_history_id to student_charges to track which package cycle the charge is for
ALTER TABLE student_charges
ADD COLUMN IF NOT EXISTS package_history_id UUID NULL REFERENCES student_package_history(id) ON DELETE SET NULL;

-- Add comment
COMMENT ON COLUMN student_charges.package_history_id IS 'Reference to the package history entry (package cycle) this charge is for';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_student_charges_package_history_id ON student_charges(package_history_id);
