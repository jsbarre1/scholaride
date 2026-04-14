-- Fix for "generation expression is not immutable"
-- We switch to a TRIGGER-based approach which is more flexible than generated columns.
-- We also add a second hash that ignores whitespace to catch more subtle plagiarism.

SET search_path = public, extensions;

-- 1. Drop EVERYTHING related to the old hashing attempt
DROP VIEW IF EXISTS public.duplicate_snapshots;
DROP VIEW IF EXISTS public.starter_file_hashes;
ALTER TABLE public.file_snapshots DROP COLUMN IF EXISTS content_hash;
ALTER TABLE public.file_snapshots DROP COLUMN IF EXISTS nowhitespace_hash;

-- 2. Add hashing columns as regular columns
ALTER TABLE public.file_snapshots ADD COLUMN content_hash TEXT;
ALTER TABLE public.file_snapshots ADD COLUMN nowhitespace_hash TEXT;

-- 3. Create a robust trigger function that calculates both hashes
CREATE OR REPLACE FUNCTION public.calculate_content_hashes()
RETURNS TRIGGER AS $$
DECLARE
  clean_content TEXT;
BEGIN
  -- Standard Hash (Exact Match)
  NEW.content_hash := encode(extensions.digest(convert_to(NEW.content, 'UTF8'), 'sha256'), 'hex');
  
  -- Semantic Hash (Ignore all whitespace to catch spacing/indentation changes)
  -- \s matches all whitespace characters in regex
  clean_content := regexp_replace(NEW.content, '\s+', '', 'g');
  NEW.nowhitespace_hash := encode(extensions.digest(convert_to(clean_content, 'UTF8'), 'sha256'), 'hex');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Apply the trigger to snapshots
DROP TRIGGER IF EXISTS trg_calculate_content_hashes ON public.file_snapshots;
CREATE TRIGGER trg_calculate_content_hashes
  BEFORE INSERT OR UPDATE ON public.file_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_content_hashes();

-- 5. BACKFILL existing snapshots (if any)
UPDATE public.file_snapshots 
SET 
  content_hash = encode(extensions.digest(convert_to(content, 'UTF8'), 'sha256'), 'hex'),
  nowhitespace_hash = encode(extensions.digest(convert_to(regexp_replace(content, '\s+', '', 'g'), 'UTF8'), 'sha256'), 'hex')
WHERE content_hash IS NULL;

-- 6. Recreate hash indexes
DROP INDEX IF EXISTS idx_snapshots_hash;
CREATE INDEX idx_snapshots_hash ON public.file_snapshots (content_hash);
CREATE INDEX idx_snapshots_nowhitespace_hash ON public.file_snapshots (nowhitespace_hash);

-- 7. Re-create the starter_file_hashes view (using semantic hash for exclusion)
CREATE OR REPLACE VIEW public.starter_file_hashes 
WITH (security_invoker = true)
AS
SELECT DISTINCT
  encode(extensions.digest(convert_to(f->>'content', 'UTF8'), 'sha256'), 'hex') as content_hash,
  encode(extensions.digest(convert_to(regexp_replace(f->>'content', '\s+', '', 'g'), 'UTF8'), 'sha256'), 'hex') as nowhitespace_hash
FROM public.assignments, jsonb_array_elements(starter_files) AS f;

-- 8. Re-create the duplicate_snapshots view using the SEMANTIC hash
-- This makes it harder for students to hide plagiarism by changing indentation.
CREATE OR REPLACE VIEW public.duplicate_snapshots 
WITH (security_invoker = true)
AS
SELECT
  s.nowhitespace_hash as semantic_hash,
  s.class_id,
  s.file_path,
  COUNT(DISTINCT s.user_id)           AS student_count,
  ARRAY_AGG(DISTINCT s.user_id::text) AS student_ids,
  MAX(s.saved_at)                     AS last_seen
FROM public.file_snapshots s
LEFT JOIN public.starter_file_hashes sfh ON s.nowhitespace_hash = sfh.nowhitespace_hash
WHERE sfh.nowhitespace_hash IS NULL    -- Exclude content matching starter files (semantically)
  AND LENGTH(regexp_replace(s.content, '\s+', '', 'g')) > 40 -- Exclude trivial semantic content
GROUP BY s.nowhitespace_hash, s.class_id, s.file_path
HAVING COUNT(DISTINCT s.user_id) > 1;

-- 9. Permissions
GRANT SELECT ON public.starter_file_hashes TO authenticated;
GRANT SELECT ON public.duplicate_snapshots TO authenticated;
REVOKE ALL ON public.starter_file_hashes FROM anon;
REVOKE ALL ON public.duplicate_snapshots FROM anon;
