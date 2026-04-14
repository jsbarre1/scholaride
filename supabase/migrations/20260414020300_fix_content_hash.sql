-- Fix content_hash generation for older Postgres versions (< 16)
-- and ensure robust bytea conversion.

SET search_path = public, extensions;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Drop existing view and column to re-apply the fixed logic
DROP VIEW IF EXISTS public.duplicate_snapshots;
ALTER TABLE public.file_snapshots DROP COLUMN IF EXISTS content_hash;

-- 2. Re-add the column using pgcrypto's digest function
--    digest() is more compatible across PG versions than the new built-in sha256().
--    We use convert_to() to ensure the text is explicitly treated as UTF-8 binary.
ALTER TABLE public.file_snapshots
  ADD COLUMN content_hash TEXT
    GENERATED ALWAYS AS (encode(digest(content::bytea, 'sha256'), 'hex')) STORED;

-- 3. Recreate the hash index
DROP INDEX IF EXISTS idx_snapshots_hash;
CREATE INDEX idx_snapshots_hash ON public.file_snapshots (content_hash);

-- 4. Recreate the duplicate_snapshots view
CREATE OR REPLACE VIEW public.duplicate_snapshots AS
SELECT
  content_hash,
  file_path,
  COUNT(DISTINCT user_id)           AS student_count,
  ARRAY_AGG(DISTINCT user_id::text) AS student_ids,
  MAX(saved_at)                     AS last_seen
FROM public.file_snapshots
GROUP BY content_hash, file_path
HAVING COUNT(DISTINCT user_id) > 1
ORDER BY student_count DESC, last_seen DESC;

-- 5. Re-apply the access restriction
REVOKE SELECT ON public.duplicate_snapshots FROM authenticated;
REVOKE SELECT ON public.duplicate_snapshots FROM anon;
