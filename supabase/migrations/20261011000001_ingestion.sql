-- REQUIEM ingestion engine: page-level extractions + chunks for grounding/mapping.

create table if not exists public.resource_extractions (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  page_no int,
  text text not null default '',
  chars int not null default 0,
  created_at timestamptz not null default now(),
  unique (resource_id, page_no)
);

create table if not exists public.resource_chunks (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  seq int not null default 0,
  page_no int,
  heading text,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists chunks_course_idx on public.resource_chunks (course_id);
create index if not exists chunks_resource_idx on public.resource_chunks (resource_id);
-- trigram-free keyword search fallback
create index if not exists chunks_text_idx on public.resource_chunks using gin (to_tsvector('english', text));

alter table public.resource_extractions enable row level security;
alter table public.resource_chunks enable row level security;
drop policy if exists "extractions_owner_all" on public.resource_extractions;
create policy "extractions_owner_all" on public.resource_extractions
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "chunks_owner_all" on public.resource_chunks;
create policy "chunks_owner_all" on public.resource_chunks
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

alter table public.courses add column if not exists syllabus_status text not null default 'none'
  check (syllabus_status in ('none','processing','needs_review','confirmed'));
alter table public.courses add column if not exists syllabus_path text;
