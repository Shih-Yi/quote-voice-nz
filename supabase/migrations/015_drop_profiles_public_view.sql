-- Drop unused profiles_public view.
-- Originally created in 010_profile_identity_fields.sql to expose non-sensitive
-- profile fields (excluding bank_account) to anon users for public quote pages.
-- Superseded by api.get_quote_by_slug_with_owner RPC (011), which returns the
-- same owner fields via SECURITY DEFINER in a single call. The view has had
-- zero callers since 011 shipped.

DROP VIEW IF EXISTS api.profiles_public;
