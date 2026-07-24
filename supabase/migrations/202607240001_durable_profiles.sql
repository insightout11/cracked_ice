create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Cracked Ice manager' check (char_length(display_name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_documents (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  revision bigint not null default 1 check (revision >= 1),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.profiles (id, display_name)
select id, coalesce(nullif(raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(email, 'Cracked Ice manager'), '@', 1))
from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.workspace_documents enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "workspace_select_own" on public.workspace_documents;
create policy "workspace_select_own"
  on public.workspace_documents for select to authenticated
  using ((select auth.uid()) = profile_id);

drop policy if exists "workspace_insert_own" on public.workspace_documents;
create policy "workspace_insert_own"
  on public.workspace_documents for insert to authenticated
  with check ((select auth.uid()) = profile_id and revision = 1);

drop policy if exists "workspace_update_own" on public.workspace_documents;
create policy "workspace_update_own"
  on public.workspace_documents for update to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, 'Cracked Ice manager'), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists auth_user_created_profile on auth.users;
create trigger auth_user_created_profile
  after insert on auth.users
  for each row execute procedure public.create_profile_for_auth_user();

create or replace function public.enforce_workspace_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.profile_id <> old.profile_id then
    raise exception 'workspace profile_id is immutable';
  end if;
  if new.revision <> old.revision + 1 then
    raise exception 'workspace revision must advance by exactly one';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workspace_revision_guard on public.workspace_documents;
create trigger workspace_revision_guard
  before update on public.workspace_documents
  for each row execute procedure public.enforce_workspace_revision();

revoke all on public.profiles from anon;
revoke all on public.workspace_documents from anon;
revoke all on public.profiles from authenticated;
revoke all on public.workspace_documents from authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.workspace_documents to authenticated;
