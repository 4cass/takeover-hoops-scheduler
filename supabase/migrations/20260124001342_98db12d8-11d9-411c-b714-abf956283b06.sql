-- Update the student remaining balance trigger to include charges
CREATE OR REPLACE FUNCTION public.update_student_remaining_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.students
  SET remaining_balance = GREATEST(0, 
    COALESCE(total_training_fee, 0) - 
    COALESCE(downpayment, 0) - 
    COALESCE((
      SELECT SUM(payment_amount) 
      FROM public.student_payments 
      WHERE student_id = NEW.student_id
    ), 0) +
    COALESCE((
      SELECT SUM(amount) 
      FROM public.student_charges 
      WHERE student_id = NEW.student_id
    ), 0)
  ),
  updated_at = now()
  WHERE id = NEW.student_id;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for updating balance when charges are added
CREATE OR REPLACE FUNCTION public.update_student_balance_on_charge()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.students
  SET remaining_balance = GREATEST(0, 
    COALESCE(total_training_fee, 0) - 
    COALESCE(downpayment, 0) - 
    COALESCE((
      SELECT SUM(payment_amount) 
      FROM public.student_payments 
      WHERE student_id = NEW.student_id
    ), 0) +
    COALESCE((
      SELECT SUM(amount) 
      FROM public.student_charges 
      WHERE student_id = NEW.student_id
    ), 0)
  ),
  updated_at = now()
  WHERE id = NEW.student_id;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for charge insert
CREATE TRIGGER update_balance_on_charge_insert
AFTER INSERT ON public.student_charges
FOR EACH ROW
EXECUTE FUNCTION public.update_student_balance_on_charge();

-- Create trigger for charge update
CREATE TRIGGER update_balance_on_charge_update
AFTER UPDATE ON public.student_charges
FOR EACH ROW
EXECUTE FUNCTION public.update_student_balance_on_charge();

-- Create trigger for charge delete
CREATE OR REPLACE FUNCTION public.update_student_balance_on_charge_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.students
  SET remaining_balance = GREATEST(0, 
    COALESCE(total_training_fee, 0) - 
    COALESCE(downpayment, 0) - 
    COALESCE((
      SELECT SUM(payment_amount) 
      FROM public.student_payments 
      WHERE student_id = OLD.student_id
    ), 0) +
    COALESCE((
      SELECT SUM(amount) 
      FROM public.student_charges 
      WHERE student_id = OLD.student_id
    ), 0)
  ),
  updated_at = now()
  WHERE id = OLD.student_id;
  
  RETURN OLD;
END;
$function$;

CREATE TRIGGER update_balance_on_charge_delete
AFTER DELETE ON public.student_charges
FOR EACH ROW
EXECUTE FUNCTION public.update_student_balance_on_charge_delete();