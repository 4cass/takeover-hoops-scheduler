-- Tag attendance records with the package cycle they belong to
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS package_cycle integer;

CREATE INDEX IF NOT EXISTS idx_attendance_records_package_cycle
  ON public.attendance_records(package_cycle);









