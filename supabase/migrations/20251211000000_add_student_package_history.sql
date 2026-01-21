-- Track player package history instead of overwriting it on renewal
create extension if not exists "pgcrypto";

create table if not exists public.student_package_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  package_type text,
  sessions numeric,
  remaining_sessions numeric,
  enrollment_date date,
  expiration_date date,
  captured_at timestamptz not null default now(),
  reason text
);

create index if not exists idx_student_package_history_student_id
  on public.student_package_history(student_id);

create index if not exists idx_student_package_history_captured_at
  on public.student_package_history(captured_at desc);









