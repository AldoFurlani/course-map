-- Add missing UPDATE policy for course_material_chunks
-- Required for writing embeddings back to chunks after generation
create policy "Professors and TAs can update chunks"
  on public.course_material_chunks for update
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') in ('professor', 'ta')
  );
