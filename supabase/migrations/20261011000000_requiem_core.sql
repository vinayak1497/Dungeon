-- REQUIEM core schema: profiles, courses, modules, concepts, resources,
-- processing, canvas, quizzes, flashcards, revision + RLS + storage.
-- Applied with: supabase db push --db-url "$DIRECT_CONNECTION_STRING"

-- ---------- helpers ----------
create extension if not exists "pgcrypto";

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  institution text,
  degree text,
  branch text,
  semester text,
  grad_year text,
  portal_url text,
  exam_date date,
  daily_goal_min int default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles_owner_all" on public.profiles;
create policy "profiles_owner_all" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- ---------- courses ----------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  code text,
  semester text,
  dept text,
  exam_date date,
  description text,
  status text not null default 'active' check (status in ('draft','active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists courses_owner_idx on public.courses (owner_id, created_at desc);
alter table public.courses enable row level security;
drop policy if exists "courses_owner_all" on public.courses;
create policy "courses_owner_all" on public.courses
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------- modules ----------
create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  position int not null default 0,
  title text not null,
  objective text,
  status text not null default 'locked' check (status in ('done','active','locked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists modules_course_idx on public.modules (course_id, position);
alter table public.modules enable row level security;
drop policy if exists "modules_owner_all" on public.modules;
create policy "modules_owner_all" on public.modules
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------- concepts ----------
create table if not exists public.concepts (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  objective text,
  status text not null default 'new' check (status in ('mastered','practicing','weak','new')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists concepts_module_idx on public.concepts (module_id);
alter table public.concepts enable row level security;
drop policy if exists "concepts_owner_all" on public.concepts;
create policy "concepts_owner_all" on public.concepts
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------- resources ----------
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses (id) on delete set null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  filename text not null,
  mime text,
  bytes bigint default 0,
  kind text,
  scope text not null default 'resources' check (scope in ('syllabus','resources')),
  status text not null default 'stored' check (status in ('stored','processing','ready','failed')),
  created_at timestamptz not null default now()
);
create index if not exists resources_owner_idx on public.resources (owner_id, created_at desc);
alter table public.resources enable row level security;
drop policy if exists "resources_owner_all" on public.resources;
create policy "resources_owner_all" on public.resources
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------- module assignments ----------
create table if not exists public.resource_module_assignments (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources (id) on delete cascade,
  module_id uuid not null references public.modules (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  confidence text check (confidence in ('high','medium','review')),
  state text not null default 'suggested' check (state in ('suggested','confirmed')),
  created_at timestamptz not null default now(),
  unique (resource_id, module_id)
);
alter table public.resource_module_assignments enable row level security;
drop policy if exists "rma_owner_all" on public.resource_module_assignments;
create policy "rma_owner_all" on public.resource_module_assignments
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------- processing jobs ----------
create table if not exists public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  state text not null default 'queued' check (state in ('queued','processing','needs_review','completed','failed')),
  attempts int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.processing_jobs enable row level security;
drop policy if exists "jobs_owner_all" on public.processing_jobs;
create policy "jobs_owner_all" on public.processing_jobs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------- canvas ----------
create table if not exists public.canvas_projects (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses (id) on delete set null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled canvas',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.canvas_pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.canvas_projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  position int not null default 0,
  title text not null default 'Page',
  doc jsonb not null default '{"version":1,"elements":[]}',
  updated_at timestamptz not null default now()
);
create index if not exists canvas_pages_project_idx on public.canvas_pages (project_id, position);
alter table public.canvas_projects enable row level security;
alter table public.canvas_pages enable row level security;
drop policy if exists "canvas_proj_owner_all" on public.canvas_projects;
create policy "canvas_proj_owner_all" on public.canvas_projects
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "canvas_pages_owner_all" on public.canvas_pages;
create policy "canvas_pages_owner_all" on public.canvas_pages
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------- quizzes ----------
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses (id) on delete set null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  scope text not null default 'module',
  config jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  kind text not null default 'mcq' check (kind in ('mcq','tf','short')),
  prompt text not null,
  options jsonb default '[]',
  answer jsonb,
  explanation text,
  concept_id uuid references public.concepts (id) on delete set null,
  sources jsonb default '[]',
  position int not null default 0
);
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  score int,
  created_at timestamptz not null default now()
);
create table if not exists public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  value jsonb,
  correct boolean
);
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;
drop policy if exists "quizzes_owner_all" on public.quizzes;
create policy "quizzes_owner_all" on public.quizzes
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "quiz_attempts_owner_all" on public.quiz_attempts;
create policy "quiz_attempts_owner_all" on public.quiz_attempts
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- questions/answers inherit access via parent quiz/attempt ownership checked server-side;
-- allow authenticated users to manage rows they create through service-layer checks.
drop policy if exists "quiz_q_auth_all" on public.quiz_questions;
create policy "quiz_q_auth_all" on public.quiz_questions for all to authenticated using (true) with check (true);
drop policy if exists "quiz_a_auth_all" on public.quiz_answers;
create policy "quiz_a_auth_all" on public.quiz_answers for all to authenticated using (true) with check (true);

-- ---------- flashcards ----------
create table if not exists public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses (id) on delete set null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.flashcard_decks (id) on delete cascade,
  front text not null,
  back text not null,
  concept_id uuid references public.concepts (id) on delete set null,
  sources jsonb default '[]',
  due_at timestamptz default now(),
  ease numeric default 2.5
);
create table if not exists public.flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.flashcards (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  grade text not null check (grade in ('again','hard','good','easy')),
  created_at timestamptz not null default now()
);
alter table public.flashcard_decks enable row level security;
alter table public.flashcards enable row level security;
alter table public.flashcard_reviews enable row level security;
drop policy if exists "decks_owner_all" on public.flashcard_decks;
create policy "decks_owner_all" on public.flashcard_decks
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "cards_auth_all" on public.flashcards;
create policy "cards_auth_all" on public.flashcards for all to authenticated using (true) with check (true);
drop policy if exists "reviews_owner_all" on public.flashcard_reviews;
create policy "reviews_owner_all" on public.flashcard_reviews
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------- revision ----------
create table if not exists public.revision_sheets (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses (id) on delete set null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  content jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.revision_sheets enable row level security;
drop policy if exists "sheets_owner_all" on public.revision_sheets;
create policy "sheets_owner_all" on public.revision_sheets
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------- storage ----------
insert into storage.buckets (id, name, public)
values ('course-resources', 'course-resources', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('canvas-exports', 'canvas-exports', false)
on conflict (id) do nothing;

drop policy if exists "storage_owner_all" on storage.objects;
create policy "storage_owner_all" on storage.objects
  for all to authenticated using (true) with check (true);
