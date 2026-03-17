-- Drop concept_chunks table — no longer read by any feature.
-- Was used for LLM-assigned chunk mappings during graph generation,
-- now replaced by semantic search for question generation context.
drop table if exists public.concept_chunks;

-- Remove unused concept_id column from course_materials.
-- Materials are linked to concepts via semantic search, not a direct FK.
alter table public.course_materials
  drop column if exists concept_id;
