
-- Remove the duplicate foreign key constraint that's causing the embedding issue
ALTER TABLE public.training_sessions 
DROP CONSTRAINT IF EXISTS training_sessions_branch_id_fkey;

-- Keep only the named constraint fk_training_sessions_branch
-- (This constraint should already exist and is the one we want to keep)
