-- Restrict the duplicate_snapshots plagiarism view to service-role only.
--
-- Context:
--   The underlying file_snapshots table has RLS, so a student querying
--   duplicate_snapshots via the standard API would only ever see their own
--   rows (HAVING COUNT(DISTINCT user_id) > 1 always returns nothing for them).
--   There is no data leak, but the view is semantically wrong to expose to
--   students at all — it is an instructor-only tool.
--
-- Access pattern:
--   Instructors query this view from a secure backend using the Supabase
--   service-role key (which bypasses RLS). It must NOT be queried from the
--   ScholarIDE client app.
--
-- This migration:
--   1. Revokes SELECT from authenticated (students) and anon roles.
--   2. Leaves SELECT granted only to the postgres/service role (service_role
--      in Supabase bypasses RLS and retains superuser-equivalent access).

REVOKE SELECT ON public.duplicate_snapshots FROM authenticated;
REVOKE SELECT ON public.duplicate_snapshots FROM anon;
