-- Migration: Drop waitlist table (no longer used — free tier replaces waitlist flow)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'api' AND table_name = 'waitlist'
  ) THEN
    DROP TABLE api.waitlist;
  END IF;
END $$;
