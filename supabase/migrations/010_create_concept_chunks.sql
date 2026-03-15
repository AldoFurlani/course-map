-- Junction table linking concepts to their source material chunks.
-- Populated during "Generate from Materials" so that question generation
-- can retrieve grounded context via direct lookup instead of semantic search.

create table public.concept_chunks (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references public.concepts(id) on delete cascade,
  chunk_id uuid not null references public.course_material_chunks(id) on delete cascade,
  created_at timestamptz default now(),
  unique(concept_id, chunk_id)
);

-- Index for fast lookup by concept (the primary access pattern)
create index idx_concept_chunks_concept on public.concept_chunks(concept_id);

-- Enable RLS
alter table public.concept_chunks enable row level security;

create policy "Authenticated users can read concept_chunks"
  on public.concept_chunks for select
  using (auth.uid() is not null);

create policy "Professors and TAs can insert concept_chunks"
  on public.concept_chunks for insert
  with check (
    (auth.jwt() -> 'user_metadata' ->> 'role') in ('professor', 'ta')
  );

create policy "Professors and TAs can delete concept_chunks"
  on public.concept_chunks for delete
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') in ('professor', 'ta')
  );
