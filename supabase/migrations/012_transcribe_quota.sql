-- NOTE: Superseded by 020_fix_transcribe_quota_api_schema.sql.
-- Migration 012 originally created objects in the 'public' schema, but the server
-- client uses schema 'api'. See 020 for the active schema definition.
--
-- Daily quota tracking for /api/transcribe. Single table serves two purposes:
--   1. Enforcement — via the atomic increment_transcribe_quota_if_allowed RPC
--   2. Analytics    — via ordinary SQL aggregates over scope/date
--
-- Scopes:
--   'global' + identifier='all'   → overall daily infra cap
--   'device' + identifier=sha256(deviceToken)  → per-anonymous-device daily cap
--   'ip'     + identifier=sha256(ip)           → per-IP daily cap
--   'user'   + identifier=user_id              → reserved for future per-user
--                                                 daily metrics (tier quota is
--                                                 enforced elsewhere)

create table if not exists transcribe_quota (
  scope text not null check (scope in ('global', 'device', 'ip', 'user')),
  identifier text not null,
  usage_date date not null,
  count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (scope, identifier, usage_date)
);

create index if not exists transcribe_quota_date_scope_idx
  on transcribe_quota (usage_date desc, scope);

alter table transcribe_quota enable row level security;

-- Service role only. Deny both authenticated and anon — this table is written
-- and read by server code only.
create policy "transcribe_quota_no_client_access"
  on transcribe_quota
  for all
  to authenticated, anon
  using (false)
  with check (false);

-- Atomic check-and-increment. Returns the new count on success, or -1 when
-- the caller would exceed p_limit.
--
-- Atomicity: the seed INSERT is a no-op if the row exists; the UPDATE then
-- takes a row-level lock and the WHERE count < p_limit guards against TOCTOU
-- between concurrent requests.
create or replace function increment_transcribe_quota_if_allowed(
  p_scope text,
  p_identifier text,
  p_date date,
  p_limit int
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into transcribe_quota (scope, identifier, usage_date, count)
  values (p_scope, p_identifier, p_date, 0)
  on conflict (scope, identifier, usage_date) do nothing;

  update transcribe_quota
    set count = count + 1,
        updated_at = now()
    where scope = p_scope
      and identifier = p_identifier
      and usage_date = p_date
      and count < p_limit
    returning count into v_count;

  if v_count is null then
    return -1;
  end if;

  return v_count;
end;
$$;

revoke all on function increment_transcribe_quota_if_allowed(text, text, date, int)
  from public, anon, authenticated;

comment on table transcribe_quota is
  'Daily quota counters for /api/transcribe. Enforcement and analytics source.';
comment on function increment_transcribe_quota_if_allowed is
  'Atomic check-and-increment. Returns new count, or -1 when at/over limit.';
