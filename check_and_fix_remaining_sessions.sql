-- Check current column type
SELECT 
    column_name, 
    data_type, 
    numeric_precision, 
    numeric_scale 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'students' 
  AND column_name = 'remaining_sessions';

-- If the above shows data_type = 'integer', run the following:
-- ALTER TABLE public.students 
-- ALTER COLUMN remaining_sessions TYPE numeric(10, 2) USING remaining_sessions::numeric(10, 2);

-- After running the ALTER, verify the change:
-- SELECT 
--     column_name, 
--     data_type, 
--     numeric_precision, 
--     numeric_scale 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name = 'students' 
--   AND column_name = 'remaining_sessions';
-- This should now show data_type = 'numeric', numeric_precision = 10, numeric_scale = 2


