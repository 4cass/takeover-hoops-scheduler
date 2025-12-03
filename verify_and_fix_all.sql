-- Step 1: Check if remaining_sessions column supports decimals
SELECT 
    column_name, 
    data_type, 
    numeric_precision, 
    numeric_scale 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'students' 
  AND column_name = 'remaining_sessions';

-- Step 2: If data_type shows 'integer', run this to change it to numeric:
-- ALTER TABLE public.students 
-- ALTER COLUMN remaining_sessions TYPE numeric(10, 2) USING remaining_sessions::numeric(10, 2);

-- Step 3: Verify the trigger function is using session_duration correctly
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'update_student_sessions';

-- Step 4: Check a sample student's remaining_sessions value
-- SELECT id, name, sessions, remaining_sessions, 
--        (sessions - remaining_sessions) as used_sessions
-- FROM public.students 
-- WHERE remaining_sessions IS NOT NULL
-- LIMIT 5;


