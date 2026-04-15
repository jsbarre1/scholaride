-- ============================================================
-- Fix: Submission Snapshots backfill was too broad.
-- The original backfill linked every snapshot saved before
-- submission time for that (student, class) pair — picking up
-- files from other assignments and unrelated work.
--
-- Correct logic: snapshots must live under the assignment's
-- directory, which is derived from the assignment title using
-- the same slugification the client uses:
--   lower(regexp_replace(title, '[^a-zA-Z0-9]', '_', 'g'))
-- ============================================================

-- 1. Wipe all incorrectly linked rows
TRUNCATE public.submission_snapshots;

-- 2. Re-backfill with path-prefix filtering
--    Only link snapshots whose file_path starts with the
--    assignment's slugified directory name.
INSERT INTO public.submission_snapshots (submission_id, snapshot_id)
SELECT DISTINCT ON (sub.id, fs.file_path)
       sub.id AS submission_id,
       fs.id  AS snapshot_id
  FROM public.submissions sub
  JOIN public.assignments a ON a.id = sub.assignment_id
  JOIN public.file_snapshots fs
    ON fs.user_id  = sub.student_id
   AND fs.class_id = a.class_id
   -- Only snapshots under the assignment's directory
   AND fs.file_path LIKE lower(regexp_replace(a.title, '[^a-zA-Z0-9]', '_', 'g')) || '/%'
   -- Only snapshots saved on or before the submission timestamp
   AND fs.saved_at <= sub.submitted_at
 ORDER BY sub.id, fs.file_path, fs.saved_at DESC   -- latest snapshot per file per submission
ON CONFLICT (submission_id, snapshot_id) DO NOTHING;
