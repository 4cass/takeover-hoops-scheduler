
-- First, let's check if there's a problematic trigger and fix it
-- The trigger is trying to access display_name which doesn't exist in auth.users

-- Drop the existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create a corrected function that properly handles user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.coaches (
    id, 
    name, 
    email, 
    role, 
    auth_id, 
    created_at, 
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'display_name', 'New Coach'),
    NEW.email,
    'coach',
    NEW.id,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- Create the trigger to automatically create coach records when auth users are created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
