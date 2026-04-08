-- 1. Create the custom ENUM type
CREATE TYPE public.app_role AS ENUM ('admin', 'instructor', 'student');

-- 2. Drop the old default and check constraint so Postgres doesn't complain during type conversion
ALTER TABLE public.profiles 
  ALTER COLUMN role DROP DEFAULT,
  DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 3. Convert the column to the new ENUM type
ALTER TABLE public.profiles 
  ALTER COLUMN role TYPE public.app_role 
  USING role::public.app_role;

-- 4. Set the new ENUM-based default value
ALTER TABLE public.profiles 
  ALTER COLUMN role SET DEFAULT 'student'::public.app_role;

-- 5. Update the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'student'::public.app_role)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
