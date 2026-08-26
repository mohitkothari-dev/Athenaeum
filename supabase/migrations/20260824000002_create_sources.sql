-- Create sources table
CREATE TABLE IF NOT EXISTS sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('pdf', 'youtube', 'audio', 'web')),
  title text NOT NULL DEFAULT 'Untitled Source',
  original_url text,
  storage_path text,
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  extracted_text text,
  course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "select_own_sources" ON sources FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_sources" ON sources FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_sources" ON sources FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_sources" ON sources FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Trigger to auto-update updated_at for sources
CREATE OR REPLACE FUNCTION update_sources_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_sources_updated_at ON sources;
CREATE TRIGGER update_sources_updated_at 
  BEFORE UPDATE ON sources 
  FOR EACH ROW 
  EXECUTE PROCEDURE update_sources_updated_at_column();

-- Add sources to the Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sources'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sources;
  END IF;
END
$$;

ALTER TABLE sources REPLICA IDENTITY FULL;

-- Create bucket for sources if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('sources', 'sources', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for the 'sources' bucket
-- Authenticated users can insert their own files
CREATE POLICY "Allow authenticated inserts to sources" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'sources' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can select their own files
CREATE POLICY "Allow authenticated select from sources" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'sources' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can update their own files
CREATE POLICY "Allow authenticated update to sources" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'sources' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can delete their own files
CREATE POLICY "Allow authenticated delete from sources" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'sources' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
