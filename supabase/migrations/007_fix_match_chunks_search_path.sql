-- Fix match_chunks function: include extensions schema in search_path
-- so the pgvector <=> operator can be resolved.
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
security definer set search_path = 'public', 'extensions'
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
