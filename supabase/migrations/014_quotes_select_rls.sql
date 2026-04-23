-- Defensive SELECT RLS policy on api.quotes.
--
-- The app reaches quotes through three paths:
--   1. Service-role server routes (/api/quotes, /api/quotes/bind) — bypass RLS
--   2. SECURITY DEFINER RPCs (get_quote_by_slug, get_device_quotes) — scoped
--      to public (sent/accepted) rows or per-device-token lists
--   3. Direct anon-key SELECTs from the browser client (lib/supabase/quotes.ts
--      getQuoteByIdFromSupabase) — this is the gap this migration closes
--
-- Without an explicit SELECT policy, anon/authenticated direct reads rely on
-- whatever implicit default is in place. This policy makes the rule explicit:
-- authenticated users see only rows they own (user_id match); anon users
-- cannot read arbitrary rows (they must use the slug RPC for public sharing).
--
-- The application code still layers local-first + user_id-match checks in
-- refreshQuoteFromCloud, so this is defence-in-depth, not the primary gate.

-- Ensure RLS is enabled (idempotent — no-op if already on). Without this,
-- the SELECT policies below are inert.
alter table api.quotes enable row level security;

-- Drop if previously defined so re-running this migration is idempotent.
drop policy if exists "quotes_select_by_ownership" on api.quotes;

create policy "quotes_select_by_ownership"
  on api.quotes
  for select
  to authenticated
  using (user_id = auth.uid());

-- Note: no explicit SELECT policy for anon. With RLS enabled, absence of a
-- matching policy means the anon role cannot SELECT directly — they must go
-- through the slug RPC (SECURITY DEFINER, which bypasses RLS for sent /
-- accepted rows only).

comment on policy "quotes_select_by_ownership" on api.quotes is
  'Authenticated users can SELECT only their own rows. Public sharing uses the '
  'get_quote_by_slug SECURITY DEFINER RPC, which bypasses RLS for sent/accepted rows.';
