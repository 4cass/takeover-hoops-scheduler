-- Add enrollment_date and expiration_date columns to students table
ALTER TABLE public.students 
ADD COLUMN enrollment_date date,
ADD COLUMN expiration_date date;