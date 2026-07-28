export type LessonStatus = 'not_started' | 'in_progress' | 'completed';

export type LearningMode = 'read' | 'summary' | 'eli10' | 'flashcards' | 'quiz' | 'practice';

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface Lesson {
  id: string;
  course_id: string;
  module_id: string;
  title: string;
  subtitle: string;
  learning_objectives: string[];
  content: string;
  quick_summary: string;
  eli10: string;
  key_takeaways: string[];
  practice: string;
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
  position: number;
  duration_minutes: number;
  created_at: string;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  description: string;
  position: number;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  user_id: string;
  title: string;
  description: string;
  topic: string;
  knowledge_level: string;
  goal: string;
  time_commitment: string;
  difficulty: string;
  estimated_duration: string;
  cover_color: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CourseWithModules extends Course {
  modules: Module[];
}

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  course_id: string;
  status: LessonStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuizResult {
  id: string;
  user_id: string;
  course_id: string;
  lesson_id: string;
  score: number;
  total: number;
  created_at: string;
}

export interface FlashcardReview {
  id: string;
  user_id: string;
  course_id: string;
  lesson_id: string;
  flashcard_index: number;
  mastery_level: number;
  review_count: number;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSession {
  user: {
    id: string;
    email: string;
  } | null;
}
