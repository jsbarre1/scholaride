-- NEW MIGRATION: Semantic Hashing (nowhitespace_hash)
-- This adds the second hashing layer to catch plagiarism that hides behind reformatting.

SET search_path = public, extensions;

-- 1. Drop EVERYTHING related to the previous hashing attempt to ensure a clean slate
DROP VIEW IF EXISTS public.duplicate_snapshots;
DROP VIEW IF EXISTS public.starter_file_hashes;

-- 2. Add hashing columns (regular columns, NOT generated, to avoid immutability issues)
ALTER TABLE public.file_snapshots DROP COLUMN IF EXISTS content_hash;
ALTER TABLE public.file_snapshots DROP COLUMN IF EXISTS nowhitespace_hash;
ALTER TABLE public.file_snapshots ADD COLUMN content_hash TEXT;
ALTER TABLE public.file_snapshots ADD COLUMN nowhitespace_hash TEXT;

-- 3. Create/Update a robust trigger function that calculates both hashes
CREATE OR REPLACE FUNCTION public.calculate_content_hashes()
RETURNS TRIGGER AS $$
DECLARE
  clean_content TEXT;
BEGIN
  -- Standard Hash (Exact Match)
  NEW.content_hash := encode(extensions.digest(convert_to(NEW.content, 'UTF8'), 'sha256'), 'hex');
  
  -- Semantic Hash (Ignore comments and whitespace to catch logic duplication)
  -- 1. Remove multi-line docstrings (Python)
  clean_content := regexp_replace(NEW.content, $re$(""".*?"""|'''.*?''')$re$, '', 'gs');
  -- 2. Remove single-line comments (#)
  clean_content := regexp_replace(clean_content, '#.*', '', 'g');
  -- 3. Remove all whitespace
  clean_content := regexp_replace(clean_content, '\s+', '', 'g');
  
  NEW.nowhitespace_hash := encode(extensions.digest(convert_to(clean_content, 'UTF8'), 'sha256'), 'hex');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Apply the trigger
DROP TRIGGER IF EXISTS trg_calculate_content_hashes ON public.file_snapshots;
CREATE TRIGGER trg_calculate_content_hashes
  BEFORE INSERT OR UPDATE ON public.file_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_content_hashes();

-- 5. RETROACTIVE BACKFILL for all existing snapshots
UPDATE public.file_snapshots 
SET 
  content_hash = encode(extensions.digest(convert_to(content, 'UTF8'), 'sha256'), 'hex'),
  nowhitespace_hash = encode(
    extensions.digest(
      convert_to(
        regexp_replace(
          regexp_replace(
            regexp_replace(content, $re$(""".*?"""|'''.*?''')$re$, '', 'gs'),
            $re$#.*$re$, '', 'g'
          ),
          $re$\s+$re$, '', 'g'
        ), 
        'UTF8'
      ), 
      'sha256'
    ), 
    'hex'
  );

-- 6. Recreate hash indexes
DROP INDEX IF EXISTS idx_snapshots_hash;
CREATE INDEX idx_snapshots_hash ON public.file_snapshots (content_hash);
DROP INDEX IF EXISTS idx_snapshots_nowhitespace_hash;
CREATE INDEX idx_snapshots_nowhitespace_hash ON public.file_snapshots (nowhitespace_hash);

-- 7. Re-create the starter_file_hashes view (using semantic hash for exclusion)
CREATE OR REPLACE VIEW public.starter_file_hashes 
WITH (security_invoker = true)
AS
SELECT DISTINCT
  encode(extensions.digest(convert_to(f->>'content', 'UTF8'), 'sha256'), 'hex') as content_hash,
  encode(
    extensions.digest(
      convert_to(
        regexp_replace(
          regexp_replace(
            regexp_replace(f->>'content', $re$(""".*?"""|'''.*?''')$re$, '', 'gs'),
            $re$#.*$re$, '', 'g'
          ),
          $re$\s+$re$, '', 'g'
        ), 
        'UTF8'
      ), 
      'sha256'
    ), 
    'hex'
  ) as nowhitespace_hash
FROM public.assignments, jsonb_array_elements(starter_files) AS f;

-- 8. Re-create the duplicate_snapshots view using the SEMANTIC hash
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
WHERE sfh.nowhitespace_hash IS NULL    -- Exclude starter files
  AND LENGTH(
    regexp_replace(
      regexp_replace(
        regexp_replace(s.content, $re$(""".*?"""|'''.*?''')$re$, '', 'gs'),
        $re$#.*$re$, '', 'g'
      ),
      $re$\s+$re$, '', 'g'
    )
  ) > 40 -- Exclude trivial content
GROUP BY s.nowhitespace_hash, s.class_id, s.file_path
HAVING COUNT(DISTINCT s.user_id) > 1;

-- 9. Permissions
GRANT SELECT ON public.starter_file_hashes TO authenticated;
GRANT SELECT ON public.duplicate_snapshots TO authenticated;
REVOKE ALL ON public.starter_file_hashes FROM anon;
REVOKE ALL ON public.duplicate_snapshots FROM anon;
