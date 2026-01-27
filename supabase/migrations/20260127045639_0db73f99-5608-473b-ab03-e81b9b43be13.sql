-- Fix remaining_balance calculations for extra charges by using UNPAID portion
-- Remaining balance = training fee balance due + unpaid extra charges
-- where training fee balance due = total_training_fee - downpayment - sum(balance payments)
-- and unpaid extra charges = sum(max(amount - paid_amount, 0))
-- Only applies to CURRENT package: package_history_id IS NULL, and date >= enrollment_date

CREATE OR REPLACE FUNCTION public.update_student_remaining_balance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  UPDATE public.students s
  SET remaining_balance = GREATEST(0,
    COALESCE(s.total_training_fee, 0)
    - COALESCE(s.downpayment, 0)
    - COALESCE((
      SELECT SUM(sp.payment_amount)
      FROM public.student_payments sp
      WHERE sp.student_id = NEW.student_id
        AND sp.package_history_id IS NULL
        AND sp.payment_for = 'balance'
        AND sp.payment_date::date >= COALESCE(s.enrollment_date, '1900-01-01'::date)
    ), 0)
    + COALESCE((
      SELECT SUM(GREATEST(sc.amount - COALESCE(sc.paid_amount, 0), 0))
      FROM public.student_charges sc
      WHERE sc.student_id = NEW.student_id
        AND sc.package_history_id IS NULL
        AND sc.created_at::date >= COALESCE(s.enrollment_date, '1900-01-01'::date)
    ), 0)
  ),
  updated_at = now()
  WHERE s.id = NEW.student_id;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_student_remaining_balance_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  UPDATE public.students s
  SET remaining_balance = GREATEST(0,
    COALESCE(s.total_training_fee, 0)
    - COALESCE(s.downpayment, 0)
    - COALESCE((
      SELECT SUM(sp.payment_amount)
      FROM public.student_payments sp
      WHERE sp.student_id = OLD.student_id
        AND sp.package_history_id IS NULL
        AND sp.payment_for = 'balance'
        AND sp.payment_date::date >= COALESCE(s.enrollment_date, '1900-01-01'::date)
    ), 0)
    + COALESCE((
      SELECT SUM(GREATEST(sc.amount - COALESCE(sc.paid_amount, 0), 0))
      FROM public.student_charges sc
      WHERE sc.student_id = OLD.student_id
        AND sc.package_history_id IS NULL
        AND sc.created_at::date >= COALESCE(s.enrollment_date, '1900-01-01'::date)
    ), 0)
  ),
  updated_at = now()
  WHERE s.id = OLD.student_id;

  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_student_balance_on_charge()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  UPDATE public.students s
  SET remaining_balance = GREATEST(0,
    COALESCE(s.total_training_fee, 0)
    - COALESCE(s.downpayment, 0)
    - COALESCE((
      SELECT SUM(sp.payment_amount)
      FROM public.student_payments sp
      WHERE sp.student_id = NEW.student_id
        AND sp.package_history_id IS NULL
        AND sp.payment_for = 'balance'
        AND sp.payment_date::date >= COALESCE(s.enrollment_date, '1900-01-01'::date)
    ), 0)
    + COALESCE((
      SELECT SUM(GREATEST(sc.amount - COALESCE(sc.paid_amount, 0), 0))
      FROM public.student_charges sc
      WHERE sc.student_id = NEW.student_id
        AND sc.package_history_id IS NULL
        AND sc.created_at::date >= COALESCE(s.enrollment_date, '1900-01-01'::date)
    ), 0)
  ),
  updated_at = now()
  WHERE s.id = NEW.student_id;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_student_balance_on_charge_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  UPDATE public.students s
  SET remaining_balance = GREATEST(0,
    COALESCE(s.total_training_fee, 0)
    - COALESCE(s.downpayment, 0)
    - COALESCE((
      SELECT SUM(sp.payment_amount)
      FROM public.student_payments sp
      WHERE sp.student_id = OLD.student_id
        AND sp.package_history_id IS NULL
        AND sp.payment_for = 'balance'
        AND sp.payment_date::date >= COALESCE(s.enrollment_date, '1900-01-01'::date)
    ), 0)
    + COALESCE((
      SELECT SUM(GREATEST(sc.amount - COALESCE(sc.paid_amount, 0), 0))
      FROM public.student_charges sc
      WHERE sc.student_id = OLD.student_id
        AND sc.package_history_id IS NULL
        AND sc.created_at::date >= COALESCE(s.enrollment_date, '1900-01-01'::date)
    ), 0)
  ),
  updated_at = now()
  WHERE s.id = OLD.student_id;

  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_student_remaining_balance_on_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF (OLD.total_training_fee IS DISTINCT FROM NEW.total_training_fee)
     OR (OLD.downpayment IS DISTINCT FROM NEW.downpayment)
     OR (OLD.enrollment_date IS DISTINCT FROM NEW.enrollment_date) THEN

    UPDATE public.students s
    SET remaining_balance = GREATEST(0,
      COALESCE(NEW.total_training_fee, 0)
      - COALESCE(NEW.downpayment, 0)
      - COALESCE((
        SELECT SUM(sp.payment_amount)
        FROM public.student_payments sp
        WHERE sp.student_id = NEW.id
          AND sp.package_history_id IS NULL
          AND sp.payment_for = 'balance'
          AND sp.payment_date::date >= COALESCE(NEW.enrollment_date, '1900-01-01'::date)
      ), 0)
      + COALESCE((
        SELECT SUM(GREATEST(sc.amount - COALESCE(sc.paid_amount, 0), 0))
        FROM public.student_charges sc
        WHERE sc.student_id = NEW.id
          AND sc.package_history_id IS NULL
          AND sc.created_at::date >= COALESCE(NEW.enrollment_date, '1900-01-01'::date)
      ), 0)
    ),
    updated_at = now()
    WHERE s.id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;