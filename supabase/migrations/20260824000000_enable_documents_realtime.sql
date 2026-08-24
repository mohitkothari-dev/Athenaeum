-- Enable Realtime for documents so background knowledge-page inserts via
-- EdgeRuntime.waitUntil appear instantly without manual refresh/polling.
-- Client subscribes via supabase.channel(...).on('postgres_changes', {table:'documents'})
-- This is idempotent; if already added, DO block is a no-op.

DO $$
BEGIN
  -- Ensure the publication exists (it does by default on Supabase)
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  -- Add documents table to publication if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE documents;
  END IF;
END
$$;

-- Ensure replica identity is FULL so UPDATE/DELETE payloads include all columns
-- (needed for realtime to deliver new row). Documents already has PK, but FULL
-- is more robust for filtered subscriptions.
ALTER TABLE documents REPLICA IDENTITY FULL;
