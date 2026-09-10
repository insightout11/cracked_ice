create table if not exists public.workspace_document_history (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  revision bigint not null,
  payload jsonb not null,
  archived_at timestamptz not null default now(),
  primary key (profile_id, revision)
);

alter table public.workspace_document_history enable row level security;

drop policy if exists "Users can read their workspace history" on public.workspace_document_history;
create policy "Users can read their workspace history"
  on public.workspace_document_history
  for select
  to authenticated
  using (auth.uid() = profile_id);

create or replace function public.archive_workspace_document_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_document_history (profile_id, revision, payload, archived_at)
  values (old.profile_id, old.revision, old.payload, now())
  on conflict (profile_id, revision) do nothing;
  return new;
end;
$$;

drop trigger if exists archive_workspace_document_revision on public.workspace_documents;
create trigger archive_workspace_document_revision
  before update on public.workspace_documents
  for each row execute function public.archive_workspace_document_revision();

revoke all on function public.archive_workspace_document_revision() from public;
revoke all on public.workspace_document_history from anon;
revoke all on public.workspace_document_history from authenticated;
grant select on public.workspace_document_history to authenticated;
