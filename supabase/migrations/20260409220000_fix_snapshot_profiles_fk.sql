-- Add direct foreign key from file_snapshots to profiles to enable PostgREST joins
ALTER TABLE public.file_snapshots
  DROP CONSTRAINT IF EXISTS file_snapshots_user_id_fkey,
  ADD CONSTRAINT file_snapshots_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES public.profiles(id) 
    ON DELETE CASCADE;
