-- Improve the duplicate_snapshots plagiarism view:
--
-- 1. Only flag files with meaningful content (>= 100 chars).
--    This suppresses false positives from trivial one-liners like
--    print("Hello, World!") that many students will legitimately write
--    the same way.
--
-- 2. Include first_seen and last_seen timestamps so instructors can
--    tell if matches happened close in time (suspicious) vs. days apart
--    (likely coincidental).
--
-- 3. Include sample content (first 500 chars) so the dashboard can preview
--    the code without a separate query.

-- Drop and recreate (CREATE OR REPLACE can't rename existing columns in Postgres)
DROP VIEW IF EXISTS public.duplicate_snapshots;

CREATE VIEW public.duplicate_snapshots AS
SELECT
  content_hash,
  file_path,
  COUNT(DISTINCT user_id)            AS student_count,
  ARRAY_AGG(DISTINCT user_id::text)  AS student_ids,
  MIN(saved_at)                      AS first_seen,
  MAX(saved_at)                      AS last_seen,
  -- How close in time were the saves? Small interval = more suspicious.
  MAX(saved_at) - MIN(saved_at)      AS time_spread,
  -- Preview of the duplicated code (instructor can fetch full content separately)
  LEFT(MIN(content), 500)            AS content_preview
FROM public.file_snapshots
WHERE length(content) >= 100          -- ignore trivial one-liners
GROUP BY content_hash, file_path
HAVING COUNT(DISTINCT user_id) > 1
ORDER BY student_count DESC, time_spread ASC; -- tightest time spread = most suspicious

-- Re-apply access restriction (view was replaced)
REVOKE SELECT ON public.duplicate_snapshots FROM authenticated;
REVOKE SELECT ON public.duplicate_snapshots FROM anon;
