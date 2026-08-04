-- Create canvas_documents and canvas_elements tables for Interactive Canvas feature
-- This migration adds support for infinite scrollable drawing workspaces

/*
1. New Tables
- canvas_documents — stores metadata for each canvas workspace
  - id (uuid, primary key)
  - user_id (uuid, not null, references auth.users) — canvas owner
  - title (text, not null) — canvas name
  - icon (text, nullable) — emoji or icon identifier
  - thumbnail (text, nullable) — base64 preview image
  - created_at (timestamptz)
  - updated_at (timestamptz)

- canvas_elements — stores individual drawing elements on canvases
  - id (uuid, primary key)
  - canvas_id (uuid, not null, references canvas_documents) — parent canvas
  - type (text, not null) — element type: stroke, rectangle, circle, triangle, arrow, line, text
  - position (jsonb, not null) — { x: number, y: number }
  - color (text, not null) — hex color code
  - stroke_width (int, not null) — line thickness 1-20
  - type_specific_data (jsonb, not null) — element-type-specific properties
  - created_at (timestamptz)
  - updated_at (timestamptz)

2. Security
- RLS enabled on both tables
- Users can only access their own canvases and elements
- Elements are accessible only if the parent canvas is owned by the user

3. Notes
- All tables use gen_random_uuid() for primary keys
- user_id defaults to auth.uid() for seamless inserts
- updated_at maintained by trigger
- type_specific_data stores element properties as JSONB for flexibility
*/

-- Canvas Documents table
CREATE TABLE canvas_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled Canvas',
  icon text DEFAULT '🎨',
  thumbnail text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on canvas_documents
ALTER TABLE canvas_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for canvas_documents
CREATE POLICY "select_own_canvas_documents" ON canvas_documents FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_canvas_documents" ON canvas_documents FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_canvas_documents" ON canvas_documents FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_canvas_documents" ON canvas_documents FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Canvas Elements table
CREATE TABLE canvas_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id uuid NOT NULL REFERENCES canvas_documents(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('stroke', 'rectangle', 'circle', 'triangle', 'arrow', 'line', 'text')),
  position jsonb NOT NULL,
  color text NOT NULL,
  stroke_width int NOT NULL CHECK (stroke_width >= 1 AND stroke_width <= 20),
  type_specific_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on canvas_elements
ALTER TABLE canvas_elements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for canvas_elements
-- Elements are accessible only if the parent canvas is owned by the user
CREATE POLICY "select_own_canvas_elements" ON canvas_elements FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM canvas_documents 
      WHERE canvas_documents.id = canvas_elements.canvas_id 
      AND canvas_documents.user_id = auth.uid()
    )
  );

CREATE POLICY "insert_own_canvas_elements" ON canvas_elements FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM canvas_documents 
      WHERE canvas_documents.id = canvas_elements.canvas_id 
      AND canvas_documents.user_id = auth.uid()
    )
  );

CREATE POLICY "update_own_canvas_elements" ON canvas_elements FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM canvas_documents 
      WHERE canvas_documents.id = canvas_elements.canvas_id 
      AND canvas_documents.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM canvas_documents 
      WHERE canvas_documents.id = canvas_elements.canvas_id 
      AND canvas_documents.user_id = auth.uid()
    )
  );

CREATE POLICY "delete_own_canvas_elements" ON canvas_elements FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM canvas_documents 
      WHERE canvas_documents.id = canvas_elements.canvas_id 
      AND canvas_documents.user_id = auth.uid()
    )
  );

-- Trigger to auto-update updated_at on canvas_documents
CREATE OR REPLACE FUNCTION update_canvas_documents_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_canvas_documents_updated_at 
  BEFORE UPDATE ON canvas_documents 
  FOR EACH ROW 
  EXECUTE PROCEDURE update_canvas_documents_updated_at_column();

-- Trigger to auto-update updated_at on canvas_elements
CREATE OR REPLACE FUNCTION update_canvas_elements_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_canvas_elements_updated_at 
  BEFORE UPDATE ON canvas_elements 
  FOR EACH ROW 
  EXECUTE PROCEDURE update_canvas_elements_updated_at_column();

-- Create index on canvas_id for efficient element queries
CREATE INDEX idx_canvas_elements_canvas_id ON canvas_elements(canvas_id);

-- Create index on created_at for ordering elements by creation time
CREATE INDEX idx_canvas_elements_created_at ON canvas_elements(canvas_id, created_at);
