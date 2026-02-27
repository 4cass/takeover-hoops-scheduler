
INSERT INTO public.coaches (id, name, email, role, auth_id, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)),
  email,
  'admin',
  id,
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'chaewonniya@gmail.com'
ON CONFLICT DO NOTHING;
