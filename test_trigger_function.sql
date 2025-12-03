-- Test query to check if the trigger function is using session_duration correctly
-- Run this to see what values are being used

-- Check recent attendance records with their session_duration
SELECT 
    ar.id,
    ar.student_id,
    s.name as student_name,
    ar.status,
    ar.session_duration,
    s.remaining_sessions,
    s.sessions,
    (s.sessions - s.remaining_sessions) as used_sessions,
    ar.marked_at
FROM public.attendance_records ar
JOIN public.students s ON ar.student_id = s.id
WHERE ar.status = 'present'
ORDER BY ar.marked_at DESC
LIMIT 10;

-- Check the trigger function definition
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'update_student_sessions';


