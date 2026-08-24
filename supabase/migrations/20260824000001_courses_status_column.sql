-- Add status column to courses so the edge function can signal async
-- generation progress back to the client via Realtime.
--
-- Values:
--   'generating' — placeholder row inserted, Gemini call in progress
--   'ready'      — course + all modules/lessons persisted successfully
--   'error'      — Gemini or DB write failed; error_message has details

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS status        text    NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS error_message text;

-- Back-fill existing rows so they're 'ready' (they were generated synchronously)
UPDATE courses SET status = 'ready' WHERE status = 'ready' OR status IS NULL;

-- Add courses to the Realtime publication so the client can subscribe to
-- status updates without polling.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'courses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE courses;
  END IF;
END
$$;

-- FULL replica identity so UPDATE payloads include all columns (needed for
-- filtered Realtime subscriptions on user_id).
ALTER TABLE courses REPLICA IDENTITY FULL;
