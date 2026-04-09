-- Allow instructors to view snapshots for any class they own
CREATE POLICY "Instructors can read snapshots in their classes"
  ON public.file_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = file_snapshots.class_id
        AND classes.instructor_id = auth.uid()
    )
  );

-- Allow instructors to view profiles of students enrolled in their classes
CREATE POLICY "Instructors can read profiles of enrolled students"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments
      JOIN public.classes ON classes.id = enrollments.class_id
      WHERE enrollments.student_id = public.profiles.id
        AND classes.instructor_id = auth.uid()
    )
  );
