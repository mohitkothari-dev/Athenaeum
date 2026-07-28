/*
# Drop old learning app tables and create AI Course Generator schema

This migration drops the old single-tenant tables from the previous version
and creates the new multi-user schema for the AI Course Generator platform.

1. Dropped Tables (old version, no user data to preserve — app was never used)
- notes
- lesson_progress (old version with text lesson_id)
- flashcard_mastery
- quiz_results (old version with text lesson_id)

2. New Tables — see create_ai_course_generator_tables migration for full details
- courses (multi-user, user_id defaults to auth.uid())
- modules (child of courses)
- lessons (child of modules, with AI-generated content, flashcards, quiz, etc.)
- lesson_progress (per-user completion tracking)
- quiz_results (per-user quiz scores)
- flashcard_reviews (per-user flashcard mastery)

3. Security
- RLS enabled on all tables.
- Owner-scoped CRUD via auth.uid() = user_id.
- Child tables scoped through course ownership.

4. Notes
- All owner columns default to auth.uid() for seamless client inserts.
- JSON fields (flashcards, quiz, objectives, takeaways) stored as text.
*/

DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS lesson_progress CASCADE;
DROP TABLE IF EXISTS flashcard_mastery CASCADE;
DROP TABLE IF EXISTS quiz_results CASCADE;

-- Courses
CREATE TABLE courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  topic text NOT NULL,
  knowledge_level text NOT NULL,
  goal text NOT NULL,
  time_commitment text NOT NULL,
  difficulty text NOT NULL,
  estimated_duration text NOT NULL,
  cover_color text NOT NULL DEFAULT 'terracotta',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_courses" ON courses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_courses" ON courses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_courses" ON courses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_courses" ON courses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Modules
CREATE TABLE modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_modules" ON modules FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM courses WHERE courses.id = modules.course_id AND courses.user_id = auth.uid()));
CREATE POLICY "insert_own_modules" ON modules FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM courses WHERE courses.id = modules.course_id AND courses.user_id = auth.uid()));
CREATE POLICY "update_own_modules" ON modules FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM courses WHERE courses.id = modules.course_id AND courses.user_id = auth.uid()));
CREATE POLICY "delete_own_modules" ON modules FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM courses WHERE courses.id = modules.course_id AND courses.user_id = auth.uid()));

-- Lessons
CREATE TABLE lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  subtitle text NOT NULL,
  learning_objectives text NOT NULL DEFAULT '[]',
  content text NOT NULL DEFAULT '',
  quick_summary text NOT NULL DEFAULT '',
  eli10 text NOT NULL DEFAULT '',
  key_takeaways text NOT NULL DEFAULT '[]',
  practice text NOT NULL DEFAULT '',
  flashcards text NOT NULL DEFAULT '[]',
  quiz text NOT NULL DEFAULT '[]',
  position int NOT NULL DEFAULT 0,
  duration_minutes int NOT NULL DEFAULT 10,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_lessons" ON lessons FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM courses WHERE courses.id = lessons.course_id AND courses.user_id = auth.uid()));
CREATE POLICY "insert_own_lessons" ON lessons FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM courses WHERE courses.id = lessons.course_id AND courses.user_id = auth.uid()));
CREATE POLICY "update_own_lessons" ON lessons FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM courses WHERE courses.id = lessons.course_id AND courses.user_id = auth.uid()));
CREATE POLICY "delete_own_lessons" ON lessons FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM courses WHERE courses.id = lessons.course_id AND courses.user_id = auth.uid()));

-- Lesson Progress
CREATE TABLE lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started',
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_lesson_progress" ON lesson_progress FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_lesson_progress" ON lesson_progress FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_lesson_progress" ON lesson_progress FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_lesson_progress" ON lesson_progress FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Quiz Results
CREATE TABLE quiz_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  score int NOT NULL,
  total int NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_quiz_results" ON quiz_results FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_quiz_results" ON quiz_results FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_quiz_results" ON quiz_results FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Flashcard Reviews
CREATE TABLE flashcard_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  flashcard_index int NOT NULL,
  mastery_level int NOT NULL DEFAULT 0,
  review_count int NOT NULL DEFAULT 0,
  last_reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, lesson_id, flashcard_index)
);

ALTER TABLE flashcard_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_flashcard_reviews" ON flashcard_reviews FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_flashcard_reviews" ON flashcard_reviews FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_flashcard_reviews" ON flashcard_reviews FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_flashcard_reviews" ON flashcard_reviews FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
