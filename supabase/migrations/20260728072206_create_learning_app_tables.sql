/*
# Create learning app tables (single-tenant, no auth)

1. New Tables
- `notes` — personal notes the learner writes while studying.
  - id (uuid, primary key)
  - lesson_id (text, not null) — references a lesson by its string identifier
  - course_id (text, not null) — references a course by its string identifier
  - content (text, not null) — the note body
  - created_at (timestamptz)
  - updated_at (timestamptz)
- `lesson_progress` — tracks completion and reading position per lesson.
  - id (uuid, primary key)
  - lesson_id (text, not null, unique) — one row per lesson
  - course_id (text, not null)
  - status (text, not null, default 'not_started') — 'not_started' | 'in_progress' | 'completed'
  - scroll_position (float, default 0) — fractional scroll position to resume reading
  - completed_at (timestamptz, nullable)
  - created_at (timestamptz)
  - updated_at (timestamptz)
- `flashcard_mastery` — tracks spaced-repetition mastery level per flashcard.
  - id (uuid, primary key)
  - flashcard_id (text, not null, unique) — one row per flashcard
  - course_id (text, not null)
  - mastery_level (int, not null, default 0) — 0=new, 1=learning, 2=familiar, 3=mastered
  - review_count (int, not null, default 0)
  - last_reviewed_at (timestamptz, nullable)
  - created_at (timestamptz)
  - updated_at (timestamptz)
- `quiz_results` — stores quiz attempt scores.
  - id (uuid, primary key)
  - course_id (text, not null)
  - lesson_id (text, not null)
  - score (int, not null) — number of correct answers
  - total (int, not null) — total questions
  - created_at (timestamptz)

2. Security
- Enable RLS on all tables.
- Allow anon + authenticated CRUD on all tables because the data is intentionally
  shared/public (single-tenant app with no sign-in screen).

3. Notes
- All tables use gen_random_uuid() for primary keys.
- updated_at is maintained by the application; no trigger is added to keep things simple.
- lesson_id, course_id, and flashcard_id are plain text identifiers that match the
  in-app curriculum content; they are not foreign keys to other tables.
*/

CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id text NOT NULL,
  course_id text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_notes" ON notes;
CREATE POLICY "anon_select_notes" ON notes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_notes" ON notes;
CREATE POLICY "anon_insert_notes" ON notes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_notes" ON notes;
CREATE POLICY "anon_update_notes" ON notes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_notes" ON notes;
CREATE POLICY "anon_delete_notes" ON notes FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id text NOT NULL UNIQUE,
  course_id text NOT NULL,
  status text NOT NULL DEFAULT 'not_started',
  scroll_position float NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_lesson_progress" ON lesson_progress;
CREATE POLICY "anon_select_lesson_progress" ON lesson_progress FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_lesson_progress" ON lesson_progress;
CREATE POLICY "anon_insert_lesson_progress" ON lesson_progress FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_lesson_progress" ON lesson_progress;
CREATE POLICY "anon_update_lesson_progress" ON lesson_progress FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_lesson_progress" ON lesson_progress;
CREATE POLICY "anon_delete_lesson_progress" ON lesson_progress FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS flashcard_mastery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flashcard_id text NOT NULL UNIQUE,
  course_id text NOT NULL,
  mastery_level int NOT NULL DEFAULT 0,
  review_count int NOT NULL DEFAULT 0,
  last_reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE flashcard_mastery ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_flashcard_mastery" ON flashcard_mastery;
CREATE POLICY "anon_select_flashcard_mastery" ON flashcard_mastery FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_flashcard_mastery" ON flashcard_mastery;
CREATE POLICY "anon_insert_flashcard_mastery" ON flashcard_mastery FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_flashcard_mastery" ON flashcard_mastery;
CREATE POLICY "anon_update_flashcard_mastery" ON flashcard_mastery FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_flashcard_mastery" ON flashcard_mastery;
CREATE POLICY "anon_delete_flashcard_mastery" ON flashcard_mastery FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS quiz_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id text NOT NULL,
  lesson_id text NOT NULL,
  score int NOT NULL,
  total int NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_quiz_results" ON quiz_results;
CREATE POLICY "anon_select_quiz_results" ON quiz_results FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_quiz_results" ON quiz_results;
CREATE POLICY "anon_insert_quiz_results" ON quiz_results FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_quiz_results" ON quiz_results;
CREATE POLICY "anon_delete_quiz_results" ON quiz_results FOR DELETE
  TO anon, authenticated USING (true);
