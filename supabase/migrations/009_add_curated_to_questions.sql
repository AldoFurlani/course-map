-- Add curated flag to questions
-- Professors toggle this to make questions visible to students in the question bank
alter table public.questions add column curated boolean not null default false;

-- Partial index for efficient curated-only queries
create index idx_questions_curated on public.questions(curated) where curated = true;
