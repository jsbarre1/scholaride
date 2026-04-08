-- Update the profiles role check to include 'admin'
-- This allows us to have super-users who can oversee all classes.

ALTER TABLE public.profiles 
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('student', 'instructor', 'admin'));
