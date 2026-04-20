-- Add OAuth identity fields to profiles
-- full_name / avatar_url come from Google OAuth (or any future provider)
-- business_name stays user-editable (e.g., "Mike's Plumbing Ltd")

ALTER TABLE api.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Refresh public view so quote pages can show name/avatar (non-sensitive).
-- bank_account remains excluded.
CREATE OR REPLACE VIEW api.profiles_public AS
SELECT
  id,
  full_name,
  avatar_url,
  business_name,
  phone,
  email,
  address
FROM api.profiles;

GRANT SELECT ON api.profiles_public TO anon, authenticated;
