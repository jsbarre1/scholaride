-- ============================================================
-- ScholarIDE Assignment Submissions
-- assignments → submissions
-- ============================================================

CREATE TABLE public.submissions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID        NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id    UUID        NOT NULL REFERENCES public.profiles(id)    ON DELETE CASCADE,
  content       JSONB       NOT NULL DEFAULT '[]'::jsonb, -- Array of {path: string, content: string}
  score         NUMERIC,
  feedback      TEXT,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one submission per student per assignment
  UNIQUE(assignment_id, student_id)
);

-- Index for faster lookups
CREATE INDEX idx_submissions_assignment ON public.submissions(assignment_id);
CREATE INDEX idx_submissions_student    ON public.submissions(student_id);

-- Enable RLS
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- ── RLS POLICIES ─────────────────────────────────────────────────────────────

-- 1. Instructors can read and update all submissions for their assignments
CREATE POLICY "Instructors can manage submissions for their assignments"
  ON public.submissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments
      JOIN public.classes ON classes.id = assignments.class_id
      WHERE assignments.id = submissions.assignment_id
        AND classes.instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assignments
      JOIN public.classes ON classes.id = assignments.class_id
      WHERE assignments.id = submissions.assignment_id
        AND classes.instructor_id = auth.uid()
    )
  );

-- 2. Students can view their own submissions
CREATE POLICY "Students can view own submissions"
  ON public.submissions
  FOR SELECT
  USING (auth.uid() = student_id);

-- 3. Students can insert their own submissions if they are enrolled in the class
CREATE POLICY "Students can submit to assignments they are enrolled in"
  ON public.submissions
  FOR INSERT
  WITH CHECK (
    auth.uid() = student_id AND
    EXISTS (
      SELECT 1 FROM public.assignments
      JOIN public.enrollments ON enrollments.class_id = assignments.class_id
      WHERE assignments.id = assignment_id
        AND enrollments.student_id = auth.uid()
    )
  );

-- 4. Students can update their own content
CREATE POLICY "Students can update own submissions"
  ON public.submissions
  FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- ── GRADING PROTECTION ───────────────────────────────────────────────────────

-- Trigger to ensure only instructors can set/modify score and feedback
CREATE OR REPLACE FUNCTION public.protect_submission_grading()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the current user is the instructor of the class this assignment belongs to
  IF EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.classes c ON c.id = a.class_id
    WHERE a.id = NEW.assignment_id
    AND c.instructor_id = auth.uid()
  ) THEN
    -- User is instructor, allow everything
    RETURN NEW;
  ELSE
    -- User is student (or at least not instructor of this class)
    -- Prevent them from setting/modifying score or feedback
    IF (TG_OP = 'UPDATE') THEN
      NEW.score := OLD.score;
      NEW.feedback := OLD.feedback;
    ELSIF (TG_OP = 'INSERT') THEN
      NEW.score := NULL;
      NEW.feedback := NULL;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_protect_submission_grading
BEFORE INSERT OR UPDATE ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.protect_submission_grading();

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_submissions_updated_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
