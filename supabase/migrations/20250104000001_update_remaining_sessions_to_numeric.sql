-- Change remaining_sessions from INTEGER to NUMERIC to support decimal values (0.5, 1.5, etc.)
ALTER TABLE public.students 
ALTER COLUMN remaining_sessions TYPE numeric(10, 2) USING remaining_sessions::numeric(10, 2);


