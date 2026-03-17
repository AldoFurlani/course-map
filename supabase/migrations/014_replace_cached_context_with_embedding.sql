-- Replace cached_context (text) with cached_embedding (vector).
-- The embedding is reusable across both question generation and material panel search.
-- Invalidated when materials are uploaded or concept name/description is edited.
alter table public.concepts
  drop column if exists cached_context;

alter table public.concepts
  add column cached_embedding extensions.vector(384) default null;
