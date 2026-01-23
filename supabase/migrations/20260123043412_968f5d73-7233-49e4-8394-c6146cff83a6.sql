-- Add extra_charges column to student_payments table
ALTER TABLE public.student_payments 
ADD COLUMN IF NOT EXISTS extra_charges numeric(10, 2) DEFAULT 0;

-- Add notes column to students table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS notes TEXT;