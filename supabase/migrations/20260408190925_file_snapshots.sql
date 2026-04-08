-- file_snapshots: Anti-cheat audit trail for ScholarIDE
-- Every Cmd+S in the editor writes a row here (skipped if content is unchanged via hash comparison in the client).
-- Instructors query this table to review student work and detect plagiarism.

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.file_snapshots (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path    TEXT        NOT NULL,   -- relative path, e.g. "project/main.py"
  content_hash TEXT        NOT NULL,   -- SHA-256 hex of content (for dedup & plagiarism)
  content      TEXT        NOT NULL,   -- full file content at time of save
  saved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Efficient lookups per student/file/time for instructor dashboard
CREATE INDEX IF NOT EXISTS idx_snapshots_user_path_time
  ON public.file_snapshots (user_id, file_path, saved_at DESC);

-- Cross-student hash comparison (plagiarism detection)
CREATE INDEX IF NOT EXISTS idx_snapshots_hash
  ON public.file_snapshots (content_hash);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.file_snapshots ENABLE ROW LEVEL SECURITY;

-- Students can only insert their own snapshots
CREATE POLICY "Students can insert own snapshots"
  ON public.file_snapshots
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Students can read their own snapshots (e.g. for a "my history" view)
CREATE POLICY "Students can read own snapshots"
  ON public.file_snapshots
  FOR SELECT
  USING (auth.uid() = user_id);

-- ── Plagiarism detection view ─────────────────────────────────────────────────
-- Shows files where multiple distinct students share the same content hash.
-- Query from the instructor dashboard via service-role key only.

CREATE OR REPLACE VIEW public.duplicate_snapshots AS
SELECT
  content_hash,
  file_path,
  COUNT(DISTINCT user_id)          AS student_count,
  ARRAY_AGG(DISTINCT user_id::text) AS student_ids,
  MAX(saved_at)                    AS last_seen
FROM public.file_snapshots
GROUP BY content_hash, file_path
HAVING COUNT(DISTINCT user_id) > 1
ORDER BY student_count DESC, last_seen DESC;
