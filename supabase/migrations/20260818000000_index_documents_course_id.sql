-- Add an index on documents.course_id so the per-course knowledge-page
-- lookup (SELECT * FROM documents WHERE course_id = $1) stays fast even
-- as the documents table grows.
--
-- The column and FK already exist from the 20260730 migration
-- (course_id uuid REFERENCES courses(id) ON DELETE SET NULL).
-- This migration only adds the supporting index; no schema changes.

CREATE INDEX IF NOT EXISTS idx_documents_course_id
  ON documents (course_id)
  WHERE course_id IS NOT NULL;
