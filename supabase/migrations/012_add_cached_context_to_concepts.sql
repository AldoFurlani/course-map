-- Cache semantic search results on concepts to avoid re-embedding + vector search
-- on every question generation. Invalidated when materials are uploaded or concept is edited.
alter table public.concepts
  add column cached_context text default null;
