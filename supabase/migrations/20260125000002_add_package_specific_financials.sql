-- Add financial fields to student_package_history to track fees per package cycle
ALTER TABLE student_package_history
ADD COLUMN IF NOT EXISTS total_training_fee NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS downpayment NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC(10, 2) DEFAULT 0;

-- Add comments
COMMENT ON COLUMN student_package_history.total_training_fee IS 'Total training fee for this specific package cycle';
COMMENT ON COLUMN student_package_history.downpayment IS 'Downpayment made for this specific package cycle';
COMMENT ON COLUMN student_package_history.remaining_balance IS 'Remaining balance for this specific package cycle';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_student_package_history_remaining_balance ON student_package_history(remaining_balance);
