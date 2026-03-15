-- Fix infinite recursion in profiles RLS policy.
-- The old policy queried profiles to check the role, causing a circular dependency.
-- The fix reads the role from the JWT user_metadata instead.

drop policy "Professors and TAs can read all profiles" on public.profiles;

create policy "Professors and TAs can read all profiles"
  on public.profiles for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') in ('professor', 'ta')
  );
