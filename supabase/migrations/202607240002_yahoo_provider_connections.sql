create table if not exists public.provider_connections (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('yahoo')),
  provider_user_id text not null,
  encrypted_tokens jsonb not null,
  access_expires_at timestamptz not null,
  permissions text[] not null default '{}',
  status text not null default 'connected' check (status in ('connected', 'reauthorize', 'error')),
  revision bigint not null default 1 check (revision >= 1),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, provider)
);

create table if not exists public.provider_oauth_attempts (
  state_hash text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('yahoo')),
  encrypted_verifier jsonb not null,
  return_url text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.provider_connections enable row level security;
alter table public.provider_oauth_attempts enable row level security;

revoke all on public.provider_connections from anon, authenticated;
revoke all on public.provider_oauth_attempts from anon, authenticated;

create or replace function public.advance_provider_connection_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.profile_id <> old.profile_id or new.provider <> old.provider then
    raise exception 'provider connection identity is immutable';
  end if;
  new.revision = old.revision + 1;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists provider_connection_revision on public.provider_connections;
create trigger provider_connection_revision
  before update on public.provider_connections
  for each row execute procedure public.advance_provider_connection_revision();

comment on table public.provider_connections is 'Server-only encrypted provider credentials. Never grant browser roles access.';
comment on table public.provider_oauth_attempts is 'Short-lived server-only OAuth state and PKCE verifier envelopes.';
