-- ============================================================
-- ScholarIDE Enrollment Grade
-- Adds a `grade` column to `enrollments` that is automatically
-- recalculated whenever a submission score is inserted/updated/deleted.
-- Grade = average score (0-100) across all graded submissions for
-- assignments belonging to the enrollment's class.
-- ============================================================

-- 1. Add the grade column
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS grade NUMERIC CHECK (grade >= 0 AND grade <= 100);

-- ── TRIGGER: auto-update grade on submission change ───────────────────────────

-- 2. Function that recalculates the grade for one (student, class) pair
CREATE OR REPLACE FUNCTION public.refresh_enrollment_grade()
RETURNS TRIGGER AS $$
DECLARE
  v_student_id UUID;
  v_class_id   UUID;
  v_avg        NUMERIC;
BEGIN
  -- Determine which student + class is affected
  IF TG_OP = 'DELETE' THEN
    v_student_id := OLD.student_id;
    SELECT class_id INTO v_class_id FROM public.assignments WHERE id = OLD.assignment_id;
  ELSE
    v_student_id := NEW.student_id;
    SELECT class_id INTO v_class_id FROM public.assignments WHERE id = NEW.assignment_id;
  END IF;

  -- Compute average of all graded (non-null score) submissions for this student in this class
  SELECT AVG(s.score)
    INTO v_avg
    FROM public.submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
   WHERE s.student_id = v_student_id
     AND a.class_id   = v_class_id
     AND s.score IS NOT NULL;

  -- Update the enrollment row (round to 2 decimal places)
  UPDATE public.enrollments
     SET grade = ROUND(v_avg, 2)
   WHERE student_id = v_student_id
     AND class_id   = v_class_id;

  RETURN NULL; -- AFTER trigger, return value is ignored
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach the trigger to the submissions table
DROP TRIGGER IF EXISTS tr_refresh_enrollment_grade ON public.submissions;

CREATE TRIGGER tr_refresh_enrollment_grade
AFTER INSERT OR UPDATE OF score OR DELETE
ON public.submissions
FOR EACH ROW
EXECUTE FUNCTION public.refresh_enrollment_grade();

-- 4. Backfill grades for existing submissions
UPDATE public.enrollments e
   SET grade = (
     SELECT ROUND(AVG(s.score), 2)
       FROM public.submissions s
       JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.student_id = e.student_id
        AND a.class_id   = e.class_id
        AND s.score IS NOT NULL
   );
