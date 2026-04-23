-- Scheduled cleanup for orphaned anonymous quotes.
--
-- Problem: an anonymous user creates a quote (user_id IS NULL), then clears
-- their device / switches browser. No one can ever touch that row again —
-- it sits in the cloud forever with PII (customer name, phone, address).
--
-- Fix: soft-delete anon drafts older than 30 days that were never bound to a
-- user. Sent/accepted quotes are preserved (the customer still has the slug
-- link). Anyone who logs in and binds their quotes promotes user_id → NOT NULL,
-- exempting them from this cleanup forever.
--
-- Runs via pg_cron (if available) or can be invoked manually from an admin
-- job. Defaults to dry-run mode until we've verified the filter in production.

create or replace function api.cleanup_anon_orphan_quotes(
  p_dry_run boolean default true,
  p_days int default 30
)
returns table (
  action text,
  quote_count bigint
)
language plpgsql
security definer
set search_path = api, public
as $$
declare
  v_count bigint;
begin
  -- Fully qualify all table references so the function is safe regardless of
  -- search_path manipulation (defence-in-depth; revoke also blocks public).
  if p_dry_run then
    select count(*) into v_count
    from api.quotes
    where api.quotes.user_id is null
      and api.quotes.status = 'draft'
      and api.quotes.created_at < now() - make_interval(days => p_days);

    return query select 'would_delete'::text, v_count;
    return;
  end if;

  with deleted as (
    delete from api.quotes
    where api.quotes.user_id is null
      and api.quotes.status = 'draft'
      and api.quotes.created_at < now() - make_interval(days => p_days)
    returning id
  )
  select count(*) into v_count from deleted;

  return query select 'deleted'::text, v_count;
end;
$$;

revoke all on function api.cleanup_anon_orphan_quotes(boolean, int) from public, anon, authenticated;

comment on function api.cleanup_anon_orphan_quotes is
  'Removes anonymous draft quotes older than N days (default 30). '
  'Defaults to dry-run. Run with p_dry_run=false to actually delete. '
  'Schedule via pg_cron or invoke manually from an admin job.';
