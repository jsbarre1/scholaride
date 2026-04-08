-- ============================================================
-- ScholarIDE Class Management Schema
-- profiles → classes → enrollments → file_snapshots (class-scoped)
-- ============================================================

-- ── 1. profiles ───────────────────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT        NOT NULL DEFAULT 'student'
                           CHECK (role IN ('student', 'instructor')),
  display_name TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Auto-create a profile row on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'student')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── 2. classes ────────────────────────────────────────────────────────────────
-- NOTE: The policy that references enrollments is added AFTER that table exists.

CREATE TABLE public.classes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  description   TEXT,
  join_code     TEXT        UNIQUE NOT NULL
                            DEFAULT upper(substring(gen_random_uuid()::text, 1, 8)),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- Instructors can fully manage their own classes
CREATE POLICY "Instructors can manage own classes"
  ON public.classes FOR ALL
  USING (auth.uid() = instructor_id)
  WITH CHECK (auth.uid() = instructor_id);


-- ── 3. enrollments ────────────────────────────────────────────────────────────

CREATE TABLE public.enrollments (
  student_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id    UUID        NOT NULL REFERENCES public.classes(id)  ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, class_id)
);

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Students can view their own enrollments
CREATE POLICY "Students can read own enrollments"
  ON public.enrollments FOR SELECT
  USING (auth.uid() = student_id);

-- Students can enroll themselves (via join_code flow in the app)
CREATE POLICY "Students can enroll themselves"
  ON public.enrollments FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Instructors can view enrollments for their classes
CREATE POLICY "Instructors can read class enrollments"
  ON public.enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = enrollments.class_id
        AND classes.instructor_id = auth.uid()
    )
  );

-- Instructors can remove students from their classes
CREATE POLICY "Instructors can remove enrollments"
  ON public.enrollments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = enrollments.class_id
        AND classes.instructor_id = auth.uid()
    )
  );


-- ── 4. Add deferred classes policy that references enrollments ────────────────
-- Now that enrollments exists, safe to create this policy.

CREATE POLICY "Students can read enrolled classes"
  ON public.classes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.class_id = classes.id
        AND enrollments.student_id = auth.uid()
    )
  );


-- ── 5. Add class_id to file_snapshots ─────────────────────────────────────────

ALTER TABLE public.file_snapshots
  ADD COLUMN class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL;

CREATE INDEX idx_snapshots_class
  ON public.file_snapshots (class_id, file_path, saved_at DESC);


-- ── 6. Rebuild duplicate_snapshots view scoped per class ──────────────────────

DROP VIEW IF EXISTS public.duplicate_snapshots;

CREATE VIEW public.duplicate_snapshots AS
SELECT
  fs.content_hash,
  fs.file_path,
  fs.class_id,
  c.name                               AS class_name,
  COUNT(DISTINCT fs.user_id)           AS student_count,
  ARRAY_AGG(DISTINCT fs.user_id::text) AS student_ids,
  MIN(fs.saved_at)                     AS first_seen,
  MAX(fs.saved_at)                     AS last_seen,
  MAX(fs.saved_at) - MIN(fs.saved_at)  AS time_spread,
  LEFT(MIN(fs.content), 500)           AS content_preview
FROM public.file_snapshots fs
JOIN public.classes c ON c.id = fs.class_id
WHERE length(fs.content) >= 100
GROUP BY fs.content_hash, fs.file_path, fs.class_id, c.name
HAVING COUNT(DISTINCT fs.user_id) > 1
ORDER BY student_count DESC, time_spread ASC;

-- Instructor-only: query via service-role key from the backend dashboard
REVOKE SELECT ON public.duplicate_snapshots FROM authenticated;
REVOKE SELECT ON public.duplicate_snapshots FROM anon;
