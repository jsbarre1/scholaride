-- Security Fix for starter_file_hashes
-- Adds security_invoker and restricts access.

SET search_path = public, extensions;

-- Re-create the view with security_invoker enabled
-- We must drop the dependent view first
DROP VIEW IF EXISTS public.duplicate_snapshots;
DROP VIEW IF EXISTS public.starter_file_hashes;

CREATE OR REPLACE VIEW public.starter_file_hashes 
WITH (security_invoker = true)
AS
SELECT DISTINCT
  encode(digest(f->>'content', 'sha256'), 'hex') as content_hash
FROM public.assignments, jsonb_array_elements(starter_files) AS f;

-- Grant selective access
REVOKE ALL ON public.starter_file_hashes FROM anon;
GRANT SELECT ON public.starter_file_hashes TO authenticated;

-- Re-create the dependent duplicate_snapshots view
CREATE OR REPLACE VIEW public.duplicate_snapshots 
WITH (security_invoker = true)
AS
SELECT
  s.content_hash,
  s.class_id,
  s.file_path,
  COUNT(DISTINCT s.user_id)           AS student_count,
  ARRAY_AGG(DISTINCT s.user_id::text) AS student_ids,
  MAX(s.saved_at)                     AS last_seen
FROM public.file_snapshots s
LEFT JOIN public.starter_file_hashes sfh ON s.content_hash = sfh.content_hash
WHERE sfh.content_hash IS NULL         -- Exclude content matching starter files
  AND LENGTH(s.content) > 50           -- Exclude trivial content
GROUP BY s.content_hash, s.class_id, s.file_path
HAVING COUNT(DISTINCT s.user_id) > 1;

GRANT SELECT ON public.duplicate_snapshots TO authenticated;
