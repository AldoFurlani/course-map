-- Enable pgvector extension
create extension if not exists vector with schema extensions;

-- Course materials table (uploaded files)
create table public.course_materials (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid references public.concepts(id) on delete set null,
  title text not null,
  file_name text not null,
  file_type text not null check (file_type in ('pdf', 'text', 'markdown')),
  file_path text not null,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger course_materials_updated_at
  before update on public.course_materials
  for each row execute function public.update_updated_at();

-- Course material chunks table (text chunks with embeddings)
create table public.course_material_chunks (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.course_materials(id) on delete cascade,
  chunk_text text not null,
  chunk_index integer not null,
  embedding extensions.vector(384),
  created_at timestamptz default now()
);

-- HNSW index for fast similarity search
create index idx_chunks_embedding on public.course_material_chunks
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Index for looking up chunks by material
create index idx_chunks_material on public.course_material_chunks(material_id);

-- Enable RLS
alter table public.course_materials enable row level security;
alter table public.course_material_chunks enable row level security;

-- course_materials RLS policies
create policy "Authenticated users can read course materials"
  on public.course_materials for select
  using (auth.uid() is not null);

create policy "Professors and TAs can insert course materials"
  on public.course_materials for insert
  with check (
    (auth.jwt() -> 'user_metadata' ->> 'role') in ('professor', 'ta')
  );

create policy "Professors and TAs can update course materials"
  on public.course_materials for update
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') in ('professor', 'ta')
  );

create policy "Professors and TAs can delete course materials"
  on public.course_materials for delete
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') in ('professor', 'ta')
  );

-- course_material_chunks RLS policies
create policy "Authenticated users can read chunks"
  on public.course_material_chunks for select
  using (auth.uid() is not null);

create policy "Professors and TAs can insert chunks"
  on public.course_material_chunks for insert
  with check (
    (auth.jwt() -> 'user_metadata' ->> 'role') in ('professor', 'ta')
  );

create policy "Professors and TAs can delete chunks"
  on public.course_material_chunks for delete
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') in ('professor', 'ta')
  );

-- match_chunks: similarity search function using cosine distance
create or replace function public.match_chunks(
  query_embedding extensions.vector(384),
  match_count integer default 5,
  match_threshold float default 0.7
)
returns table (
  id uuid,
  material_id uuid,
  chunk_text text,
  chunk_index integer,
  similarity float
)
language plpgsql
security definer set search_path = ''
as $$
begin
  return query
    select
      c.id,
      c.material_id,
      c.chunk_text,
      c.chunk_index,
      1 - (c.embedding <=> query_embedding) as similarity
    from public.course_material_chunks c
    where c.embedding is not null
      and 1 - (c.embedding <=> query_embedding) > match_threshold
    order by c.embedding <=> query_embedding
    limit match_count;
end;
$$;

-- Storage bucket for course material files
insert into storage.buckets (id, name, public)
values ('course-materials', 'course-materials', false)
on conflict (id) do nothing;

-- Storage policies: authenticated can read, professors/TAs can upload/delete
create policy "Authenticated users can read course material files"
  on storage.objects for select
  using (bucket_id = 'course-materials' and auth.uid() is not null);

create policy "Professors and TAs can upload course material files"
  on storage.objects for insert
  with check (
    bucket_id = 'course-materials'
    and (auth.jwt() -> 'user_metadata' ->> 'role') in ('professor', 'ta')
  );

create policy "Professors and TAs can delete course material files"
  on storage.objects for delete
  using (
    bucket_id = 'course-materials'
    and (auth.jwt() -> 'user_metadata' ->> 'role') in ('professor', 'ta')
  );
