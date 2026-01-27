-- Update the trigger function to only count current package payments/charges
-- (those where package_history_id IS NULL)

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
        AND package_history_id IS NULL
        AND payment_for = 'balance'
    ), 0) +
    COALESCE((
      SELECT SUM(amount) 
      FROM public.student_charges 
      WHERE student_id = NEW.student_id
        AND package_history_id IS NULL
    ), 0)
  ),
  updated_at = now()
  WHERE id = NEW.student_id;
  
  RETURN NEW;
END;
$function$;

-- Update the delete trigger function
CREATE OR REPLACE FUNCTION public.update_student_remaining_balance_on_delete()
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
        AND package_history_id IS NULL
        AND payment_for = 'balance'
    ), 0) +
    COALESCE((
      SELECT SUM(amount) 
      FROM public.student_charges 
      WHERE student_id = OLD.student_id
        AND package_history_id IS NULL
    ), 0)
  ),
  updated_at = now()
  WHERE id = OLD.student_id;
  
  RETURN OLD;
END;
$function$;

-- Update the charge trigger function
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
        AND package_history_id IS NULL
        AND payment_for = 'balance'
    ), 0) +
    COALESCE((
      SELECT SUM(amount) 
      FROM public.student_charges 
      WHERE student_id = NEW.student_id
        AND package_history_id IS NULL
    ), 0)
  ),
  updated_at = now()
  WHERE id = NEW.student_id;
  
  RETURN NEW;
END;
$function$;

-- Update the charge delete trigger function
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
        AND package_history_id IS NULL
        AND payment_for = 'balance'
    ), 0) +
    COALESCE((
      SELECT SUM(amount) 
      FROM public.student_charges 
      WHERE student_id = OLD.student_id
        AND package_history_id IS NULL
    ), 0)
  ),
  updated_at = now()
  WHERE id = OLD.student_id;
  
  RETURN OLD;
END;
$function$;

-- Update the student update trigger function
CREATE OR REPLACE FUNCTION public.update_student_remaining_balance_on_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
          AND package_history_id IS NULL
          AND payment_for = 'balance'
      ), 0) +
      COALESCE((
        SELECT SUM(amount) 
        FROM public.student_charges 
        WHERE student_id = NEW.id
          AND package_history_id IS NULL
      ), 0)
    ),
    updated_at = now()
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;