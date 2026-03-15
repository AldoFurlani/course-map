-- Questions table: cached AI-generated questions
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references public.concepts(id) on delete cascade,
  question_type text not null check (question_type in ('multiple_choice', 'free_response')),
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  question_text text not null,
  options jsonb, -- array of {label, text} for MC; null for free_response
  correct_answer text not null,
  explanation text not null default '',
  source_context text, -- RAG context used to generate (nullable)
  generated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create index idx_questions_concept on public.questions(concept_id);

-- Student responses table
create table public.student_responses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  concept_id uuid not null references public.concepts(id) on delete cascade,
  answer_text text not null,
  is_correct boolean not null,
  ai_feedback text not null default '',
  self_assessment integer check (self_assessment between 1 and 5),
  created_at timestamptz default now()
);

create index idx_responses_student_concept on public.student_responses(student_id, concept_id);
create index idx_responses_student_created on public.student_responses(student_id, created_at desc);

-- Readiness scores table (denormalized, one row per student x concept)
create table public.readiness_scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid not null references public.concepts(id) on delete cascade,
  raw_score float not null default 0,
  quiz_ewma float not null default 0,
  self_assessment_avg float not null default 0,
  response_count integer not null default 0,
  updated_at timestamptz default now(),
  unique(student_id, concept_id)
);

create index idx_readiness_student on public.readiness_scores(student_id);

-- Enable RLS
alter table public.questions enable row level security;
alter table public.student_responses enable row level security;
alter table public.readiness_scores enable row level security;

-- questions RLS policies
create policy "Authenticated users can read questions"
  on public.questions for select
  using (auth.uid() is not null);

create policy "Authenticated users can insert questions"
  on public.questions for insert
  with check (auth.uid() is not null);

create policy "Professors and TAs can delete questions"
  on public.questions for delete
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') in ('professor', 'ta')
  );

-- student_responses RLS policies
create policy "Students can read own responses"
  on public.student_responses for select
  using (student_id = auth.uid());

create policy "Professors and TAs can read all responses"
  on public.student_responses for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') in ('professor', 'ta')
  );

create policy "Students can insert own responses"
  on public.student_responses for insert
  with check (student_id = auth.uid());

create policy "Students can update own responses"
  on public.student_responses for update
  using (student_id = auth.uid());

-- readiness_scores RLS policies
create policy "Students can read own readiness"
  on public.readiness_scores for select
  using (student_id = auth.uid());

create policy "Professors and TAs can read all readiness"
  on public.readiness_scores for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') in ('professor', 'ta')
  );

create policy "Students can insert own readiness"
  on public.readiness_scores for insert
  with check (student_id = auth.uid());

create policy "Students can update own readiness"
  on public.readiness_scores for update
  using (student_id = auth.uid());
