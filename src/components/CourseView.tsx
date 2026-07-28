import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Clock, CheckCircle, Circle, ArrowRight, BookOpen, Loader2 } from 'lucide-react';
import type { Course, Module, LessonProgress } from '@/types';
import { fetchCourseWithModules, fetchLessonProgress } from '@/lib/api';

interface CourseViewProps {
  courseId: string;
  onOpenLesson: (courseId: string, lessonId: string) => void;
  onBack: () => void;
}

export function CourseView({ courseId, onOpenLesson, onBack }: CourseViewProps) {
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [progressMap, setProgressMap] = useState<Map<string, LessonProgress>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { course: c, modules: mods } = await fetchCourseWithModules(courseId);
      setCourse(c);
      setModules(mods);
      const progress = await fetchLessonProgress(courseId);
      setProgressMap(progress);
    } catch (err) {
      console.error('Failed to load course:', err);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const completedLessons = Array.from(progressMap.values()).filter((p) => p.status === 'completed').length;
  const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const colorMap: Record<string, string> = {
    terracotta: 'from-terracotta-300 to-terracotta-500',
    sage: 'from-sage-300 to-sage-500',
    gold: 'from-gold-200 to-gold-400',
    brick: 'from-brick-300 to-brick-500',
    ink: 'from-ink-400 to-ink-700',
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="w-8 h-8 text-warmgray-300 animate-spin mb-3" strokeWidth={1.5} />
        <p className="text-sm text-warmgray-400 font-serif">Loading course...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-20">
        <p className="font-serif text-xl text-ink-600">Course not found.</p>
        <button onClick={onBack} className="mt-4 text-sm text-terracotta-600 font-medium">
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-warmgray-400 hover:text-ink-600 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
        Back to library
      </button>

      <div className={`h-2 rounded-full bg-gradient-to-r ${colorMap[course.cover_color] || colorMap.terracotta} mb-6`} />

      <h1 className="font-serif text-3xl md:text-4xl text-ink-700 leading-tight mb-2">{course.title}</h1>
      <p className="reading-text !text-[1.0625rem] !leading-[1.75] text-warmgray-500 mb-6">{course.description}</p>

      <div className="flex flex-wrap items-center gap-4 text-xs text-warmgray-400 mb-6">
        <span className="flex items-center gap-1">
          <BookOpen className="w-3.5 h-3.5" strokeWidth={1.5} />
          {totalLessons} lessons
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
          {course.estimated_duration || 'Flexible'}
        </span>
        <span className="px-2.5 py-0.5 rounded-full bg-cream-200 text-warmgray-500 font-medium">
          {course.difficulty}
        </span>
        <span className="px-2.5 py-0.5 rounded-full bg-cream-200 text-warmgray-500 font-medium">
          {course.knowledge_level}
        </span>
      </div>

      <div className="bg-cream-100 rounded-xl2 border border-cream-200 p-5 mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-ink-600">Course Progress</span>
          <span className="font-serif text-xl text-terracotta-500 tabular-nums">{percent}%</span>
        </div>
        <div className="h-2 bg-cream-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-terracotta-400 rounded-full transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-xs text-warmgray-400 mt-2">
          {completedLessons} of {totalLessons} lessons completed
        </p>
      </div>

      <div className="space-y-8">
        {modules.map((module, mIdx) => (
          <div key={module.id}>
            <div className="flex items-baseline gap-3 mb-3">
              <span className="font-serif text-sm text-terracotta-500 font-medium">
                Module {mIdx + 1}
              </span>
              <h2 className="font-serif text-xl text-ink-700">{module.title}</h2>
            </div>
            <p className="text-sm text-warmgray-400 mb-4 leading-relaxed">{module.description}</p>

            <div className="space-y-2.5">
              {module.lessons.map((lesson, lIdx) => {
                const status = progressMap.get(lesson.id)?.status ?? 'not_started';
                const globalIdx = modules
                  .slice(0, mIdx)
                  .reduce((sum, m) => sum + m.lessons.length, 0) + lIdx + 1;

                return (
                  <button
                    key={lesson.id}
                    onClick={() => onOpenLesson(courseId, lesson.id)}
                    className="group w-full flex items-center gap-4 p-4 bg-cream-50 rounded-xl border border-cream-200 hover:border-sand-200 hover:shadow-card transition-all text-left"
                  >
                    <div className="flex-shrink-0">
                      {status === 'completed' ? (
                        <div className="w-9 h-9 rounded-full bg-sage-200 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-sage-600" strokeWidth={1.5} />
                        </div>
                      ) : status === 'in_progress' ? (
                        <div className="w-9 h-9 rounded-full bg-gold-50 border-2 border-gold-300 flex items-center justify-center">
                          <span className="text-sm font-semibold text-gold-500">{globalIdx}</span>
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-cream-200 flex items-center justify-center">
                          <span className="text-sm font-semibold text-warmgray-500">{globalIdx}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif text-lg text-ink-700 leading-snug">{lesson.title}</h3>
                      <p className="text-sm text-warmgray-400 mt-0.5">{lesson.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="hidden sm:flex items-center gap-1 text-xs text-warmgray-400">
                        <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                        {lesson.duration_minutes} min
                      </span>
                      {status === 'in_progress' && (
                        <span className="text-xs font-medium text-gold-500 bg-gold-50 px-2 py-0.5 rounded-full">
                          In progress
                        </span>
                      )}
                      <ArrowRight className="w-4 h-4 text-warmgray-300 group-hover:text-terracotta-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
