-- Update handle_new_user to use email as default display_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, display_name)
  VALUES (
    NEW.id, 
    'student', 
    NEW.email -- Set display_name to full email
  )
  ON CONFLICT (id) DO UPDATE
  SET display_name = EXCLUDED.display_name
  WHERE public.profiles.display_name IS NULL;
  
  RETURN NEW;
END;
$$;
