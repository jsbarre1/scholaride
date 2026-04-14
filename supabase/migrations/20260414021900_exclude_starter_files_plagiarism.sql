-- Exclude starter files from the duplicate_snapshots view to prevent false positives.
-- We also exclude empty files.

SET search_path = public, extensions;

-- Function to get hashes of all starter files in the system
-- We enable security_invoker to ensure it respects RLS of the assignments table.
CREATE OR REPLACE VIEW public.starter_file_hashes 
WITH (security_invoker = true)
AS
SELECT DISTINCT
  encode(digest(f->>'content', 'sha256'), 'hex') as content_hash
FROM public.assignments, jsonb_array_elements(starter_files) AS f;

-- Restrict access to authenticated users
REVOKE ALL ON public.starter_file_hashes FROM anon;
GRANT SELECT ON public.starter_file_hashes TO authenticated;

-- Update the duplicate_snapshots view
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
  AND LENGTH(s.content) > 50           -- Exclude trivial content (boilerplate/short comments)
GROUP BY s.content_hash, s.class_id, s.file_path
HAVING COUNT(DISTINCT s.user_id) > 1;
