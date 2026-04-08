-- ============================================================
-- POLISH RLS POLICIES
-- 1. Use 'authenticated' role for all policies.
-- 2. Allow students to read classes to facilitate join_code lookup.
-- ============================================================

-- ── 1. classes ────────────────────────────────────────────────────────────────

-- Remove the restrictive "read enrolled only" policy
DROP POLICY IF EXISTS "Students can read enrolled classes" ON public.classes;
DROP POLICY IF EXISTS "Instructors can manage own classes" ON public.classes;

-- New: allow any authenticated user to read all classes
-- Necessary so a student can enter a join code and find the corresponding class ID.
CREATE POLICY "authenticated_select_classes"
  ON public.classes FOR SELECT TO authenticated
  USING (true);

-- Re-apply instructor management policy restricted to authenticated
CREATE POLICY "authenticated_manage_own_classes"
  ON public.classes FOR ALL TO authenticated
  USING (auth.uid() = instructor_id)
  WITH CHECK (auth.uid() = instructor_id);


-- ── 2. enrollments ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Students can read own enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Students can enroll themselves" ON public.enrollments;
DROP POLICY IF EXISTS "Instructors can read class enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Instructors can remove enrollments" ON public.enrollments;

CREATE POLICY "authenticated_select_own_enrollments"
  ON public.enrollments FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "authenticated_insert_own_enrollments"
  ON public.enrollments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "authenticated_instructor_select_enrollments"
  ON public.enrollments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = enrollments.class_id
        AND classes.instructor_id = auth.uid()
    )
  );

CREATE POLICY "authenticated_instructor_delete_enrollments"
  ON public.enrollments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = enrollments.class_id
        AND classes.instructor_id = auth.uid()
    )
  );


-- ── 3. profiles ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "authenticated_select_own_profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "authenticated_update_own_profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);


-- ── 4. file_snapshots ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Students can insert own snapshots" ON public.file_snapshots;
DROP POLICY IF EXISTS "Students can read own snapshots" ON public.file_snapshots;

CREATE POLICY "authenticated_insert_own_snapshots"
  ON public.file_snapshots FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "authenticated_select_own_snapshots"
  ON public.file_snapshots FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
