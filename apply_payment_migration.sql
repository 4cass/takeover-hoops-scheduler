-- Add payment fields to students table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS total_training_fee numeric(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS downpayment numeric(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_balance numeric(10, 2) DEFAULT 0;

-- Create student_payments table to track individual payment entries
CREATE TABLE IF NOT EXISTS public.student_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  payment_amount numeric(10, 2) NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for better performance on student lookups
CREATE INDEX IF NOT EXISTS idx_student_payments_student_id ON public.student_payments(student_id);

-- Enable Row Level Security
ALTER TABLE public.student_payments ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists and create new one
DROP POLICY IF EXISTS "Allow all operations on student_payments" ON public.student_payments;
CREATE POLICY "Allow all operations on student_payments" ON public.student_payments FOR ALL USING (true);

-- Create function to update remaining balance when payment is added
CREATE OR REPLACE FUNCTION update_student_remaining_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.students
  SET remaining_balance = GREATEST(0, 
    COALESCE(total_training_fee, 0) - 
    COALESCE(downpayment, 0) - 
    COALESCE((
      SELECT SUM(payment_amount) 
      FROM public.student_payments 
      WHERE student_id = NEW.student_id
    ), 0)
  ),
  updated_at = now()
  WHERE id = NEW.student_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_update_remaining_balance_on_payment_insert ON public.student_payments;
CREATE TRIGGER trigger_update_remaining_balance_on_payment_insert
AFTER INSERT ON public.student_payments
FOR EACH ROW
EXECUTE FUNCTION update_student_remaining_balance();

-- Create function to update remaining balance when payment is deleted
CREATE OR REPLACE FUNCTION update_student_remaining_balance_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.students
  SET remaining_balance = GREATEST(0, 
    COALESCE(total_training_fee, 0) - 
    COALESCE(downpayment, 0) - 
    COALESCE((
      SELECT SUM(payment_amount) 
      FROM public.student_payments 
      WHERE student_id = OLD.student_id
    ), 0)
  ),
  updated_at = now()
  WHERE id = OLD.student_id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_update_remaining_balance_on_payment_delete ON public.student_payments;
CREATE TRIGGER trigger_update_remaining_balance_on_payment_delete
AFTER DELETE ON public.student_payments
FOR EACH ROW
EXECUTE FUNCTION update_student_remaining_balance_on_delete();

-- Create function to update remaining balance when student payment fields are updated
CREATE OR REPLACE FUNCTION update_student_remaining_balance_on_update()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.total_training_fee IS DISTINCT FROM NEW.total_training_fee) OR 
     (OLD.downpayment IS DISTINCT FROM NEW.downpayment) THEN
    UPDATE public.students
    SET remaining_balance = GREATEST(0, 
      COALESCE(NEW.total_training_fee, 0) - 
      COALESCE(NEW.downpayment, 0) - 
      COALESCE((
        SELECT SUM(payment_amount) 
        FROM public.student_payments 
        WHERE student_id = NEW.id
      ), 0)
    ),
    updated_at = now()
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_update_remaining_balance_on_student_update ON public.students;
CREATE TRIGGER trigger_update_remaining_balance_on_student_update
AFTER UPDATE OF total_training_fee, downpayment ON public.students
FOR EACH ROW
EXECUTE FUNCTION update_student_remaining_balance_on_update();


