-- Concepts table
create table public.concepts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Concept edges table (prerequisite DAG: source is prerequisite of target)
create table public.concept_edges (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.concepts(id) on delete cascade,
  target_id uuid not null references public.concepts(id) on delete cascade,
  created_at timestamptz default now(),
  unique(source_id, target_id),
  check (source_id != target_id)
);

-- Indexes for fast edge lookups
create index idx_concept_edges_source on public.concept_edges(source_id);
create index idx_concept_edges_target on public.concept_edges(target_id);

-- Enable RLS
alter table public.concepts enable row level security;
alter table public.concept_edges enable row level security;

-- Concepts RLS policies
create policy "Authenticated users can read concepts"
  on public.concepts for select
  using (auth.uid() is not null);

create policy "Professors and TAs can insert concepts"
  on public.concepts for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('professor', 'ta')
    )
  );

create policy "Professors and TAs can update concepts"
  on public.concepts for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('professor', 'ta')
    )
  );

create policy "Professors and TAs can delete concepts"
  on public.concepts for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('professor', 'ta')
    )
  );

-- Concept edges RLS policies
create policy "Authenticated users can read concept edges"
  on public.concept_edges for select
  using (auth.uid() is not null);

create policy "Professors and TAs can insert concept edges"
  on public.concept_edges for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('professor', 'ta')
    )
  );

create policy "Professors and TAs can delete concept edges"
  on public.concept_edges for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('professor', 'ta')
    )
  );

-- Generic updated_at trigger function (reusable by future tables)
create or replace function public.update_updated_at()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger concepts_updated_at
  before update on public.concepts
  for each row execute function public.update_updated_at();

-- ============================================================
-- Seed data: ~15 ML1 concepts with prerequisite edges
-- ============================================================

insert into public.concepts (id, name, description) values
  ('a0000000-0000-0000-0000-000000000001', 'Linear Algebra', 'Vectors, matrices, eigenvalues, and linear transformations'),
  ('a0000000-0000-0000-0000-000000000002', 'Probability & Statistics', 'Probability distributions, expectation, variance, Bayes theorem'),
  ('a0000000-0000-0000-0000-000000000003', 'Calculus', 'Derivatives, integrals, chain rule, partial derivatives'),
  ('a0000000-0000-0000-0000-000000000004', 'Gradient Descent', 'Optimization via iterative gradient steps, learning rates, convergence'),
  ('a0000000-0000-0000-0000-000000000005', 'Linear Regression', 'Ordinary least squares, closed-form solution, cost function'),
  ('a0000000-0000-0000-0000-000000000006', 'Logistic Regression', 'Binary classification, sigmoid function, cross-entropy loss'),
  ('a0000000-0000-0000-0000-000000000007', 'Regularization', 'L1/L2 penalties, bias-variance tradeoff, overfitting prevention'),
  ('a0000000-0000-0000-0000-000000000008', 'Cross-Validation', 'K-fold CV, train/validation/test splits, model selection'),
  ('a0000000-0000-0000-0000-000000000009', 'Neural Networks', 'Perceptrons, multi-layer networks, activation functions'),
  ('a0000000-0000-0000-0000-000000000010', 'Backpropagation', 'Chain rule applied to neural networks, gradient computation'),
  ('a0000000-0000-0000-0000-000000000011', 'Decision Trees', 'Information gain, entropy, Gini impurity, tree construction'),
  ('a0000000-0000-0000-0000-000000000012', 'Ensemble Methods', 'Random forests, boosting, bagging'),
  ('a0000000-0000-0000-0000-000000000013', 'SVMs', 'Maximum margin classifiers, kernel trick, support vectors'),
  ('a0000000-0000-0000-0000-000000000014', 'Clustering', 'K-means, hierarchical clustering, DBSCAN'),
  ('a0000000-0000-0000-0000-000000000015', 'Dimensionality Reduction', 'PCA, SVD, feature selection, manifold learning');

-- Prerequisite edges (source = prerequisite, target = dependent)
insert into public.concept_edges (source_id, target_id) values
  -- Calculus -> Gradient Descent
  ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004'),
  -- Linear Algebra -> Linear Regression
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005'),
  -- Gradient Descent -> Linear Regression
  ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000005'),
  -- Linear Regression -> Logistic Regression
  ('a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000006'),
  -- Probability -> Logistic Regression
  ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000006'),
  -- Linear Regression -> Regularization
  ('a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000007'),
  -- Probability -> Cross-Validation
  ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000008'),
  -- Linear Regression -> Cross-Validation
  ('a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000008'),
  -- Logistic Regression -> Neural Networks
  ('a0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000009'),
  -- Linear Algebra -> Neural Networks
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000009'),
  -- Neural Networks -> Backpropagation
  ('a0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000010'),
  -- Gradient Descent -> Backpropagation
  ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000010'),
  -- Probability -> Decision Trees
  ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000011'),
  -- Decision Trees -> Ensemble Methods
  ('a0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000012'),
  -- Cross-Validation -> Ensemble Methods
  ('a0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000012'),
  -- Linear Algebra -> SVMs
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000013'),
  -- Gradient Descent -> SVMs
  ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000013'),
  -- Linear Algebra -> Clustering
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000014'),
  -- Probability -> Clustering
  ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000014'),
  -- Linear Algebra -> Dimensionality Reduction
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000015'),
  -- Probability -> Dimensionality Reduction
  ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000015');
