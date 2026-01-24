-- Add is_paid and paid_at fields to student_charges to track payment status
ALTER TABLE student_charges
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT 0;

-- Add payment_for field to student_payments to track what the payment was for
ALTER TABLE student_payments
ADD COLUMN IF NOT EXISTS payment_for TEXT DEFAULT 'balance',
ADD COLUMN IF NOT EXISTS charge_id UUID NULL REFERENCES student_charges(id) ON DELETE SET NULL;

-- Add comments
COMMENT ON COLUMN student_charges.is_paid IS 'Whether this extra charge has been paid';
COMMENT ON COLUMN student_charges.paid_at IS 'When this charge was paid';
COMMENT ON COLUMN student_charges.paid_amount IS 'Amount paid towards this charge';
COMMENT ON COLUMN student_payments.payment_for IS 'What the payment is for: balance or extra_charge';
COMMENT ON COLUMN student_payments.charge_id IS 'Reference to specific extra charge if payment_for is extra_charge';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_student_charges_is_paid ON student_charges(is_paid);
CREATE INDEX IF NOT EXISTS idx_student_payments_charge_id ON student_payments(charge_id);
