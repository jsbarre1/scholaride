-- ============================================================
-- Option A: submissions → file_snapshots (join table)
-- Replaces the JSONB `content` column on submissions with a
-- lightweight join table so content is never duplicated.
-- ============================================================

-- 1. Create the join table
CREATE TABLE public.submission_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  snapshot_id   UUID NOT NULL REFERENCES public.file_snapshots(id) ON DELETE CASCADE,
  UNIQUE(submission_id, snapshot_id)
);

CREATE INDEX idx_submission_snapshots_sub  ON public.submission_snapshots(submission_id);
CREATE INDEX idx_submission_snapshots_snap ON public.submission_snapshots(snapshot_id);

-- 2. Enable RLS
ALTER TABLE public.submission_snapshots ENABLE ROW LEVEL SECURITY;

-- Instructors can read snapshot links for their assignments
CREATE POLICY "Instructors can read submission snapshots"
  ON public.submission_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1
        FROM public.submissions s
        JOIN public.assignments a  ON a.id  = s.assignment_id
        JOIN public.classes     c  ON c.id  = a.class_id
       WHERE s.id = submission_snapshots.submission_id
         AND c.instructor_id = auth.uid()
    )
  );

-- Students can read their own submission snapshot links
CREATE POLICY "Students can read own submission snapshots"
  ON public.submission_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
       WHERE s.id = submission_snapshots.submission_id
         AND s.student_id = auth.uid()
    )
  );

-- Students can insert their own submission snapshot links
CREATE POLICY "Students can link snapshots to own submissions"
  ON public.submission_snapshots FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.submissions s
       WHERE s.id = submission_snapshots.submission_id
         AND s.student_id = auth.uid()
    )
  );

-- 3. Backfill: for every existing submission, find file_snapshots that
--    match on (student_id, class_id, file_path) and link the latest one per path.
INSERT INTO public.submission_snapshots (submission_id, snapshot_id)
SELECT DISTINCT ON (sub.id, fs.file_path)
       sub.id        AS submission_id,
       fs.id         AS snapshot_id
  FROM public.submissions sub
  JOIN public.assignments  a  ON a.id  = sub.assignment_id
  -- Match snapshots: same student, same class, saved on or before submission time
  JOIN public.file_snapshots fs
    ON fs.user_id   = sub.student_id
   AND fs.class_id  = a.class_id
   AND fs.saved_at <= sub.submitted_at
 ORDER BY sub.id, fs.file_path, fs.saved_at DESC    -- latest snapshot per file per submission
ON CONFLICT (submission_id, snapshot_id) DO NOTHING;

-- 4. Drop the now-redundant content column
ALTER TABLE public.submissions DROP COLUMN IF EXISTS content;
