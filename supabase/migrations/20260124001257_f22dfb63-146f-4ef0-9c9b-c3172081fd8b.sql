-- Create function to update timestamps if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create table for extra charges/balance adjustments
CREATE TABLE public.student_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  charge_type TEXT NOT NULL DEFAULT 'extra_charge',
  description TEXT,
  notes TEXT,
  charge_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.student_charges ENABLE ROW LEVEL SECURITY;

-- Create policy for coaches and admins
CREATE POLICY "Coaches can view student charges"
ON public.student_charges
FOR SELECT
USING (is_user_coach_or_admin());

CREATE POLICY "Coaches can insert student charges"
ON public.student_charges
FOR INSERT
WITH CHECK (is_user_coach_or_admin());

CREATE POLICY "Coaches can update student charges"
ON public.student_charges
FOR UPDATE
USING (is_user_coach_or_admin());

CREATE POLICY "Admins can delete student charges"
ON public.student_charges
FOR DELETE
USING (is_user_admin());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_student_charges_updated_at
BEFORE UPDATE ON public.student_charges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();