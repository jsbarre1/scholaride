-- Replace the client-supplied content_hash column with a server-computed
-- generated column. The database now ALWAYS derives the hash from the content,
-- so it cannot be spoofed by a client sending a fabricated hash.
--
-- Must drop duplicate_snapshots view first (it references content_hash),
-- then recreate it after the column change.

-- 1. Enable pgcrypto (safe if already exists)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Drop the view that depends on content_hash
DROP VIEW IF EXISTS public.duplicate_snapshots;

-- 3. Drop the old client-supplied column
ALTER TABLE public.file_snapshots DROP COLUMN IF EXISTS content_hash;

-- 4. Add the server-computed generated column
--    sha256() is a built-in Postgres function (no extension needed in pg11+)
ALTER TABLE public.file_snapshots
  ADD COLUMN content_hash TEXT
    GENERATED ALWAYS AS (encode(sha256(content::bytea), 'hex')) STORED;

-- 5. Recreate the hash index
DROP INDEX IF EXISTS idx_snapshots_hash;
CREATE INDEX idx_snapshots_hash ON public.file_snapshots (content_hash);

-- 6. Recreate the duplicate_snapshots view (same logic, now using server hash)
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

-- 7. Re-apply the access restriction (view was dropped and recreated)
REVOKE SELECT ON public.duplicate_snapshots FROM authenticated;
REVOKE SELECT ON public.duplicate_snapshots FROM anon;
