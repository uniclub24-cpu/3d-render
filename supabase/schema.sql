-- Supabase SQL Editor에 붙여넣고 Run
create table if not exists public.projects (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text,
  data jsonb not null,
  thumb text,
  updated_at timestamptz not null default now()
);
alter table public.projects enable row level security;
drop policy if exists "own projects" on public.projects;
create policy "own projects" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- v7: 링크 공유 · 받은 사람 댓글 (보기 전용 링크는 로그인 없이 읽기 가능)
create table if not exists public.shares (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text,
  data jsonb not null,
  allow_comment boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.shares enable row level security;
drop policy if exists "shares read" on public.shares;
create policy "shares read" on public.shares for select using (true);
drop policy if exists "shares own" on public.shares;
create policy "shares own" on public.shares for all using (auth.uid() = owner) with check (auth.uid() = owner);

create table if not exists public.share_comments (
  id text primary key,
  share_id uuid not null references public.shares (id) on delete cascade,
  x double precision, y double precision, z double precision,
  lv text, text text not null, "by" text, t bigint,
  created_at timestamptz not null default now()
);
alter table public.share_comments enable row level security;
drop policy if exists "sc read" on public.share_comments;
create policy "sc read" on public.share_comments for select using (true);
drop policy if exists "sc add" on public.share_comments;
create policy "sc add" on public.share_comments for insert with check (
  exists (select 1 from public.shares s where s.id = share_id and s.allow_comment) and length(text) < 2000);
drop policy if exists "sc owner delete" on public.share_comments;
create policy "sc owner delete" on public.share_comments for delete using (
  exists (select 1 from public.shares s where s.id = share_id and s.owner = auth.uid()));

-- v8: 관리자 · 작업 기록 · 차단 (이 파일 전체를 다시 Run 해도 안전해요)
create table if not exists public.admins (email text primary key);
insert into public.admins (email) values ('marcus_pelic@naver.com') on conflict do nothing;
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

create table if not exists public.blocked (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text, reason text,
  at timestamptz not null default now()
);
alter table public.blocked enable row level security;
create or replace function public.is_blocked() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocked where user_id = auth.uid());
$$;
drop policy if exists "blocked read" on public.blocked;
create policy "blocked read" on public.blocked for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "blocked admin" on public.blocked;
create policy "blocked admin" on public.blocked for all using (public.is_admin()) with check (public.is_admin());

-- 프로젝트: 차단된 사람은 저장 못 함 · 관리자는 모두 읽기
drop policy if exists "own projects" on public.projects;
create policy "own projects" on public.projects for all
  using (auth.uid() = user_id and not public.is_blocked())
  with check (auth.uid() = user_id and not public.is_blocked());
drop policy if exists "admin read projects" on public.projects;
create policy "admin read projects" on public.projects for select using (public.is_admin());

create table if not exists public.activity (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  email text default (auth.jwt() ->> 'email'),
  project_id text, project_name text,
  action text not null,
  at timestamptz not null default now()
);
create index if not exists activity_at on public.activity (at desc);
alter table public.activity enable row level security;
drop policy if exists "act add" on public.activity;
create policy "act add" on public.activity for insert
  with check (user_id = auth.uid() and not public.is_blocked() and length(action) < 300);
drop policy if exists "act admin read" on public.activity;
create policy "act admin read" on public.activity for select using (public.is_admin());

create or replace function public.admin_users()
returns table (id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, projects bigint, last_action timestamptz, blocked boolean)
language sql stable security definer set search_path = public as $$
  select u.id, u.email::text, u.created_at, u.last_sign_in_at,
    (select count(*) from public.projects p where p.user_id = u.id and p.name <> '__mylib'),
    (select max(a.at) from public.activity a where a.user_id = u.id),
    exists (select 1 from public.blocked b where b.user_id = u.id)
  from auth.users u
  where public.is_admin()
  order by u.last_sign_in_at desc nulls last;
$$;
revoke all on function public.admin_users() from public, anon;
grant execute on function public.admin_users() to authenticated;

-- v17: 내 AI 키 보관 (본인만 읽고 쓰기 · 관리자도 못 봄). 같은 계정으로 로그인한 PC·폰이 자동으로 같은 키를 씀
create table if not exists public.user_secrets (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  ai_key text,
  updated_at timestamptz not null default now()
);
alter table public.user_secrets enable row level security;
drop policy if exists "own secrets" on public.user_secrets;
create policy "own secrets" on public.user_secrets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- v23: 기물 추가 원본 파일 보관 (Storage · 본인 폴더만 읽고 쓰기). 이 파일 전체를 다시 Run 해도 안전해요
insert into storage.buckets (id, name, public) values ('models', 'models', false) on conflict (id) do nothing;
drop policy if exists "models own read" on storage.objects;
create policy "models own read" on storage.objects for select using (bucket_id = 'models' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "models own add" on storage.objects;
create policy "models own add" on storage.objects for insert with check (bucket_id = 'models' and (storage.foldername(name))[1] = auth.uid()::text and not public.is_blocked());
drop policy if exists "models own update" on storage.objects;
create policy "models own update" on storage.objects for update using (bucket_id = 'models' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "models own delete" on storage.objects;
create policy "models own delete" on storage.objects for delete using (bucket_id = 'models' and (storage.foldername(name))[1] = auth.uid()::text);
