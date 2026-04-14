-- 1. Update the duplicate_snapshots view to include class_id
-- and ensure it respects isolation while allowing global detection if desired.
DROP VIEW IF EXISTS public.duplicate_snapshots;

CREATE OR REPLACE VIEW public.duplicate_snapshots AS
SELECT
  content_hash,
  class_id,
  file_path,
  COUNT(DISTINCT user_id)           AS student_count,
  ARRAY_AGG(DISTINCT user_id::text) AS student_ids,
  MAX(saved_at)                     AS last_seen
FROM public.file_snapshots
GROUP BY content_hash, class_id, file_path
HAVING COUNT(DISTINCT user_id) > 1;

-- 2. Grant SELECT to authenticated users (restricted by RLS logic or views)
-- Actually, for views, we use SECURITY BARRIER or just grant carefully.
GRANT SELECT ON public.duplicate_snapshots TO authenticated;

-- 3. Policy for instructors to read all snapshots in THEIR classes
CREATE POLICY "instructor_select_class_snapshots"
  ON public.file_snapshots FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = file_snapshots.class_id
        AND classes.instructor_id = auth.uid()
    )
  );

-- 4. Re-apply restricted selection for duplicate_snapshots view
-- We want instructors to only see duplicates for THEIR classes.
-- Postgres views don't support RLS directly unless they are security invoker.
-- In Supabase/Postgres 15+, we can use SECURITY INVOKER.
CREATE OR REPLACE VIEW public.duplicate_snapshots 
WITH (security_invoker = true)
AS
SELECT
  content_hash,
  class_id,
  file_path,
  COUNT(DISTINCT user_id)           AS student_count,
  ARRAY_AGG(DISTINCT user_id::text) AS student_ids,
  MAX(saved_at)                     AS last_seen
FROM public.file_snapshots
GROUP BY content_hash, class_id, file_path
HAVING COUNT(DISTINCT user_id) > 1;
