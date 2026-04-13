-- ============================================================
-- ScholarIDE Assignments Management
-- classes → assignments
-- ============================================================

CREATE TABLE public.assignments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      UUID        NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  description   TEXT,
  due_date      TIMESTAMPTZ,
  starter_files JSONB       NOT NULL DEFAULT '[]'::jsonb, -- Array of {path: string, content: string}
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups by class
CREATE INDEX idx_assignments_class ON public.assignments(class_id);

-- Enable Row Level Security
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- ── RLS POLICIES ─────────────────────────────────────────────────────────────

-- 1. Instructors can manage assignments for classes they own
CREATE POLICY "Instructors can manage own assignments"
  ON public.assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = assignments.class_id
        AND classes.instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = assignments.class_id
        AND classes.instructor_id = auth.uid()
    )
  );

-- 2. Students can read assignments for classes they are enrolled in
CREATE POLICY "Students can read assignments in enrolled classes"
  ON public.assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.class_id = assignments.class_id
        AND enrollments.student_id = auth.uid()
    )
  );
