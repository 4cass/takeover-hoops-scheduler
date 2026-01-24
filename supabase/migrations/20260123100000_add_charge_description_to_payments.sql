-- Add charge_description column to student_payments table
-- This field stores what the extra charge is for (e.g., "Court Fee", "Equipment", etc.)
ALTER TABLE student_payments
ADD COLUMN IF NOT EXISTS charge_description TEXT;

-- Add a comment to describe the column
COMMENT ON COLUMN student_payments.charge_description IS 'Description of what the extra charge is for (e.g., Court Fee, Equipment, Late Fee, etc.)';
