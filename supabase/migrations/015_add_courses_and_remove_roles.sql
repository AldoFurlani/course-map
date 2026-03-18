-- Migration 015: Add multi-course support and remove role system
-- Every user can now create courses, each with its own concept graph,
-- materials, questions, and progress tracking.

-- =============================================================
-- 1. Create courses table
-- =============================================================

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_courses_user on public.courses(user_id);

create trigger courses_updated_at
  before update on public.courses
  for each row execute function public.update_updated_at();

alter table public.courses enable row level security;

create policy "Users can read own courses"
  on public.courses for select
  using (user_id = auth.uid());

create policy "Users can insert own courses"
  on public.courses for insert
  with check (user_id = auth.uid());

create policy "Users can update own courses"
  on public.courses for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own courses"
  on public.courses for delete
  using (user_id = auth.uid());

-- =============================================================
-- 2. Add course_id to concepts
-- =============================================================

alter table public.concepts add column course_id uuid references public.courses(id) on delete cascade;

-- Remove old global unique constraint, add per-course unique
alter table public.concepts drop constraint if exists concepts_name_key;

-- Delete any existing data (fresh start)
delete from public.concepts;

alter table public.concepts alter column course_id set not null;
alter table public.concepts add constraint concepts_course_name_unique unique(course_id, name);
create index idx_concepts_course on public.concepts(course_id);

-- =============================================================
-- 3. Add course_id to concept_edges
-- =============================================================

alter table public.concept_edges add column course_id uuid references public.courses(id) on delete cascade;

-- Existing edges were deleted via cascade from concepts
alter table public.concept_edges alter column course_id set not null;
create index idx_concept_edges_course on public.concept_edges(course_id);

-- =============================================================
-- 4. Add course_id to course_materials
-- =============================================================

alter table public.course_materials add column course_id uuid references public.courses(id) on delete cascade;

-- Delete existing data (fresh start)
delete from public.course_materials;

alter table public.course_materials alter column course_id set not null;
create index idx_materials_course on public.course_materials(course_id);

-- =============================================================
-- 5. Add course_id to course_material_chunks
-- =============================================================

alter table public.course_material_chunks add column course_id uuid references public.courses(id) on delete cascade;

-- Existing chunks were deleted via cascade from materials
alter table public.course_material_chunks alter column course_id set not null;
create index idx_chunks_course on public.course_material_chunks(course_id);

-- =============================================================
-- 6. Add course_id to questions
-- =============================================================

alter table public.questions add column course_id uuid references public.courses(id) on delete cascade;

-- Existing questions were deleted via cascade from concepts
alter table public.questions alter column course_id set not null;
create index idx_questions_course on public.questions(course_id);

-- =============================================================
-- 7. Add course_id to student_responses
-- =============================================================

alter table public.student_responses add column course_id uuid references public.courses(id) on delete cascade;

-- Existing responses were deleted via cascade
alter table public.student_responses alter column course_id set not null;
create index idx_responses_course on public.student_responses(course_id);

-- =============================================================
-- 8. Add course_id to readiness_scores
-- =============================================================

alter table public.readiness_scores add column course_id uuid references public.courses(id) on delete cascade;

-- Existing scores were deleted via cascade
alter table public.readiness_scores alter column course_id set not null;

-- Update unique constraint
alter table public.readiness_scores drop constraint if exists readiness_scores_student_id_concept_id_key;
alter table public.readiness_scores add constraint readiness_scores_student_concept_unique unique(student_id, concept_id);

-- =============================================================
-- 9. Drop ALL old RLS policies that reference role (must happen before dropping role column)
-- =============================================================

-- profiles
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Professors and TAs can read all profiles" on public.profiles;

-- concepts
drop policy if exists "Authenticated users can read concepts" on public.concepts;
drop policy if exists "Professors and TAs can insert concepts" on public.concepts;
drop policy if exists "Professors and TAs can update concepts" on public.concepts;
drop policy if exists "Professors and TAs can delete concepts" on public.concepts;

-- concept_edges
drop policy if exists "Authenticated users can read concept edges" on public.concept_edges;
drop policy if exists "Professors and TAs can insert concept edges" on public.concept_edges;
drop policy if exists "Professors and TAs can delete concept edges" on public.concept_edges;

-- course_materials
drop policy if exists "Authenticated users can read course materials" on public.course_materials;
drop policy if exists "Professors and TAs can insert course materials" on public.course_materials;
drop policy if exists "Professors and TAs can update course materials" on public.course_materials;
drop policy if exists "Professors and TAs can delete course materials" on public.course_materials;

-- course_material_chunks
drop policy if exists "Authenticated users can read chunks" on public.course_material_chunks;
drop policy if exists "Professors and TAs can insert chunks" on public.course_material_chunks;
drop policy if exists "Professors and TAs can update chunks" on public.course_material_chunks;
drop policy if exists "Professors and TAs can delete chunks" on public.course_material_chunks;

-- questions
drop policy if exists "Authenticated users can read questions" on public.questions;
drop policy if exists "Authenticated users can insert questions" on public.questions;
drop policy if exists "Professors and TAs can update questions" on public.questions;
drop policy if exists "Professors and TAs can delete questions" on public.questions;

-- student_responses
drop policy if exists "Students can read own responses" on public.student_responses;
drop policy if exists "Professors and TAs can read all responses" on public.student_responses;
drop policy if exists "Students can insert own responses" on public.student_responses;
drop policy if exists "Students can update own responses" on public.student_responses;

-- readiness_scores
drop policy if exists "Students can read own readiness" on public.readiness_scores;
drop policy if exists "Professors and TAs can read all readiness" on public.readiness_scores;
drop policy if exists "Students can insert own readiness" on public.readiness_scores;
drop policy if exists "Students can update own readiness" on public.readiness_scores;

-- storage
drop policy if exists "Authenticated users can read course material files" on storage.objects;
drop policy if exists "Professors and TAs can upload course material files" on storage.objects;
drop policy if exists "Professors and TAs can delete course material files" on storage.objects;

-- =============================================================
-- 10. Drop role from profiles (safe now that policies are dropped)
-- =============================================================

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles drop column if exists role;

-- =============================================================
-- 10b. Update handle_new_user trigger (remove role)
-- =============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

-- =============================================================
-- 11. Create new ownership-based RLS policies
-- =============================================================

-- --- profiles ---
create policy "Users can read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- --- concepts ---
create policy "Users can read own concepts"
  on public.concepts for select
  using (exists (select 1 from public.courses where id = course_id and user_id = auth.uid()));

create policy "Users can insert own concepts"
  on public.concepts for insert
  with check (exists (select 1 from public.courses where id = course_id and user_id = auth.uid()));

create policy "Users can update own concepts"
  on public.concepts for update
  using (exists (select 1 from public.courses where id = course_id and user_id = auth.uid()))
  with check (exists (select 1 from public.courses where id = course_id and user_id = auth.uid()));

create policy "Users can delete own concepts"
  on public.concepts for delete
  using (exists (select 1 from public.courses where id = course_id and user_id = auth.uid()));

-- --- concept_edges ---
create policy "Users can read own edges"
  on public.concept_edges for select
  using (exists (select 1 from public.courses where id = course_id and user_id = auth.uid()));

create policy "Users can insert own edges"
  on public.concept_edges for insert
  with check (exists (select 1 from public.courses where id = course_id and user_id = auth.uid()));

create policy "Users can delete own edges"
  on public.concept_edges for delete
  using (exists (select 1 from public.courses where id = course_id and user_id = auth.uid()));

-- --- course_materials ---
create policy "Users can read own materials"
  on public.course_materials for select
  using (exists (select 1 from public.courses where id = course_id and user_id = auth.uid()));

create policy "Users can insert own materials"
  on public.course_materials for insert
  with check (exists (select 1 from public.courses where id = course_id and user_id = auth.uid()));

create policy "Users can update own materials"
  on public.course_materials for update
  using (exists (select 1 from public.courses where id = course_id and user_id = auth.uid()))
  with check (exists (select 1 from public.courses where id = course_id and user_id = auth.uid()));

create policy "Users can delete own materials"
  on public.course_materials for delete
  using (exists (select 1 from public.courses where id = course_id and user_id = auth.uid()));

-- --- course_material_chunks ---
create policy "Users can read own chunks"
  on public.course_material_chunks for select
  using (exists (select 1 from public.courses where id = course_id and user_id = auth.uid()));

create policy "Users can insert own chunks"
  on public.course_material_chunks for insert
  with check (exists (select 1 from public.courses where id = course_id and user_id = auth.uid()));

create policy "Users can update own chunks"
  on public.course_material_chunks for update
  using (exists (select 1 from public.courses where id = course_id and user_id = auth.uid()))
  with check (exists (select 1 from public.courses where id = course_id and user_id = auth.uid()));

create policy "Users can delete own chunks"
  on public.course_material_chunks for delete
  using (exists (select 1 from public.courses where id = course_id and user_id = auth.uid()));

-- --- questions ---
create policy "Users can read own questions"
  on public.questions for select
  using (exists (select 1 from public.courses where id = course_id and user_id = auth.uid()));

create policy "Users can insert own questions"
  on public.questions for insert
  with check (exists (select 1 from public.courses where id = course_id and user_id = auth.uid()));

create policy "Users can update own questions"
  on public.questions for update
  using (exists (select 1 from public.courses where id = course_id and user_id = auth.uid()))
  with check (exists (select 1 from public.courses where id = course_id and user_id = auth.uid()));

create policy "Users can delete own questions"
  on public.questions for delete
  using (exists (select 1 from public.courses where id = course_id and user_id = auth.uid()));

-- --- student_responses ---
create policy "Users can read own responses"
  on public.student_responses for select
  using (student_id = auth.uid());

create policy "Users can insert own responses"
  on public.student_responses for insert
  with check (student_id = auth.uid());

create policy "Users can update own responses"
  on public.student_responses for update
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- --- readiness_scores ---
create policy "Users can read own readiness"
  on public.readiness_scores for select
  using (student_id = auth.uid());

create policy "Users can insert own readiness"
  on public.readiness_scores for insert
  with check (student_id = auth.uid());

create policy "Users can update own readiness"
  on public.readiness_scores for update
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- --- storage.objects ---
create policy "Authenticated users can read course material files"
  on storage.objects for select
  using (bucket_id = 'course-materials' and auth.uid() is not null);

create policy "Authenticated users can upload course material files"
  on storage.objects for insert
  with check (bucket_id = 'course-materials' and auth.uid() is not null);

create policy "Authenticated users can delete course material files"
  on storage.objects for delete
  using (bucket_id = 'course-materials' and auth.uid() is not null);

-- =============================================================
-- 12. Update match_chunks to accept course_id
-- =============================================================

drop function if exists public.match_chunks;

create or replace function public.match_chunks(
  query_embedding extensions.vector(384),
  p_course_id uuid,
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
      (1 - (c.embedding <=> query_embedding))::float as similarity
    from public.course_material_chunks c
    where c.course_id = p_course_id
      and c.embedding is not null
      and (1 - (c.embedding <=> query_embedding)) > match_threshold
    order by c.embedding <=> query_embedding
    limit match_count;
end;
$$;
