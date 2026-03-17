-- Add page_number to chunks so we can locate content in original PDFs
alter table public.course_material_chunks
  add column if not exists page_number integer;

-- Index for quick page lookups by material
create index if not exists idx_chunks_material_page on public.course_material_chunks(material_id, page_number);

-- Drop old function signature before recreating with new return type
drop function if exists public.match_chunks(extensions.vector, integer, float);

-- Recreate match_chunks with page_number in the return type
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
  page_number integer,
  similarity float
)
language plpgsql
security definer set search_path = 'public', 'extensions'
as $$
begin
  return query
    select
      c.id,
      c.material_id,
      c.chunk_text,
      c.chunk_index,
      c.page_number,
      1 - (c.embedding <=> query_embedding) as similarity
    from public.course_material_chunks c
    where c.embedding is not null
      and 1 - (c.embedding <=> query_embedding) > match_threshold
    order by c.embedding <=> query_embedding
    limit match_count;
end;
$$;
