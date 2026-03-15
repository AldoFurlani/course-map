-- Allow professors and TAs to update questions
create policy "Professors and TAs can update questions"
  on public.questions for update
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') in ('professor', 'ta')
  );
