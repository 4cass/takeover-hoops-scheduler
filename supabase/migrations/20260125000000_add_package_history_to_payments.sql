-- Add package_history_id to student_payments to track which package cycle the payment is for
ALTER TABLE student_payments
ADD COLUMN IF NOT EXISTS package_history_id UUID NULL REFERENCES student_package_history(id) ON DELETE SET NULL;

-- Add comment
COMMENT ON COLUMN student_payments.package_history_id IS 'Reference to the package history entry (package cycle) this payment is for';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_student_payments_package_history_id ON student_payments(package_history_id);
