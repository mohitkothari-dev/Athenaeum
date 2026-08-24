import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Clock, CheckCircle, ArrowRight, BookOpen, Loader2, FileText,
  AlertTriangle, RefreshCw, Trash2,
} from 'lucide-react';
import type { Course, Module, LessonProgress, AppDocument } from '@/types';
import {
  fetchCourseWithModules,
  fetchLessonProgress,
  fetchDocumentByCourseId,
  deleteCourse,
} from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { COURSE_COLOR_GRADIENTS } from '@/lib/courseColors';

interface CourseViewProps {
  courseId: string;
  onOpenLesson: (courseId: string, lessonId: string) => void;
  onOpenPage: (documentId: string) => void;
  onBack: () => void;
}

// ── Skeleton helpers ──────────────────────────────────────────────────────────

function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`bg-cream-200 rounded animate-pulse ${className}`} />;
}

function GeneratingSkeleton({ topic }: { topic: string }) {
  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Back */}
      <div className="flex items-center gap-1.5 text-sm text-warmgray-300 mb-6 select-none">
        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
        Back to library
      </div>

      {/* Colour bar */}
      <div className="h-2 rounded-full bg-cream-200 animate-pulse mb-6" />

      {/* Status banner */}
      <div className="flex items-center gap-3 mb-6 p-4 bg-cream-50 rounded-xl border border-cream-200">
        <Loader2 className="w-5 h-5 text-terracotta-500 animate-spin flex-shrink-0" strokeWidth={1.5} />
        <div>
          <p className="text-sm font-medium text-ink-700">Generating your course on <span className="text-terracotta-600">{topic}</span>…</p>
          <p className="text-xs text-warmgray-400 mt-0.5">This usually takes 20–60 seconds. You can leave and come back.</p>
        </div>
      </div>

      {/* Title skeleton */}
      <SkeletonLine className="h-9 w-3/4 mb-3" />
      <SkeletonLine className="h-4 w-full mb-1.5" />
      <SkeletonLine className="h-4 w-2/3 mb-6" />

      {/* Chips */}
      <div className="flex gap-3 mb-6">
        <SkeletonLine className="h-5 w-20 rounded-full" />
        <SkeletonLine className="h-5 w-24 rounded-full" />
        <SkeletonLine className="h-5 w-16 rounded-full" />
      </div>

      {/* Progress card */}
      <div className="bg-cream-100 rounded-xl2 border border-cream-200 p-5 mb-8">
        <SkeletonLine className="h-4 w-32 mb-3" />
        <SkeletonLine className="h-2 w-full rounded-full" />
      </div>

      {/* Module skeletons */}
      {[0, 1].map((mIdx) => (
        <div key={mIdx} className="mb-8">
          <div className="flex items-baseline gap-3 mb-3">
            <SkeletonLine className="h-4 w-16" />
            <SkeletonLine className="h-6 w-40" />
          </div>
          <SkeletonLine className="h-3 w-3/4 mb-4" />
          <div className="space-y-2.5">
            {[0, 1, 2].map((lIdx) => (
              <div key={lIdx} className="flex items-center gap-4 p-4 bg-cream-50 rounded-xl border border-cream-200">
                <SkeletonLine className="w-9 h-9 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <SkeletonLine className="h-4 w-48" />
                  <SkeletonLine className="h-3 w-32" />
                </div>
                <SkeletonLine className="h-3 w-12 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({
  topic,
  message,
  courseId,
  onBack,
  onDeleted,
}: {
  topic: string;
  message: string | null;
  courseId: string;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCourse(courseId);
      onDeleted();
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-warmgray-400 hover:text-ink-600 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
        Back to library
      </button>

      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7 text-red-400" strokeWidth={1.5} />
        </div>
        <h2 className="font-serif text-2xl text-ink-700 mb-2">Generation failed</h2>
        <p className="text-sm text-warmgray-500 mb-1">
          Could not generate the course on <span className="font-medium text-ink-600">{topic}</span>.
        </p>
        {message && (
          <p className="text-xs text-warmgray-400 max-w-md mb-6 leading-relaxed">{message}</p>
        )}
        <div className="flex gap-3 mt-2">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cream-100 border border-cream-200 text-sm font-medium text-ink-600 hover:bg-cream-200 transition-all"
          >
            <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
            Try again
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-sm font-medium text-red-600 hover:bg-red-100 transition-all disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
            {deleting ? 'Deleting…' : 'Delete this course'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CourseView({ courseId, onOpenLesson, onOpenPage, onBack }: CourseViewProps) {
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [progressMap, setProgressMap] = useState<Map<string, LessonProgress>>(new Map());
  const [knowledgePage, setKnowledgePage] = useState<AppDocument | null>(null);
  const [loading, setLoading] = useState(true);

  const loadContent = useCallback(async () => {
    try {
      const [{ course: c, modules: mods }, progress, page] = await Promise.all([
        fetchCourseWithModules(courseId),
        fetchLessonProgress(courseId),
        fetchDocumentByCourseId(courseId),
      ]);
      setCourse(c);
      setModules(mods);
      setProgressMap(progress);
      setKnowledgePage(page);
      return c;
    } catch (err) {
      console.error('Failed to load course:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    loadContent();
  }, [loadContent]);

  // While the course is generating, poll every 4 seconds so we don't depend
  // solely on Realtime delivery (which can be slow or miss events depending on
  // replica identity configuration). Polling stops as soon as status is no
  // longer 'generating'. Realtime is kept as a fast-path that can resolve
  // things sooner when it works.
  useEffect(() => {
    if (!course || course.status !== 'generating') return;

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      const updated = await loadContent();
      // loadContent already called setCourse; if status is still generating
      // we'll be called again by the next interval tick.
      if (updated && updated.status !== 'generating') {
        cancelled = true; // stop further ticks
      }
    };

    const interval = setInterval(poll, 4000);
    // Safety ceiling: stop after 3 minutes regardless
    const ceiling = setTimeout(() => { cancelled = true; clearInterval(interval); }, 180000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(ceiling);
    };
  }, [course?.status, courseId, loadContent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: fast-path for status transitions. Triggers an immediate
  // loadContent() so the UI flips without waiting for the next poll tick.
  useEffect(() => {
    const channel = supabase
      .channel(`course-status-${courseId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'courses',
          filter: `id=eq.${courseId}`,
        },
        (payload) => {
          const updated = payload.new as Course;
          if (updated.status === 'ready') {
            loadContent();
          } else if (updated.status === 'error') {
            setCourse(updated);
            setLoading(false);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [courseId, loadContent]);

  // Poll for the knowledge page after content is loaded (it arrives ~10–30s
  // after the course becomes ready via the background task).
  useEffect(() => {
    if (loading || !course || course.status !== 'ready' || knowledgePage) return;

    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const page = await fetchDocumentByCourseId(courseId);
        if (page && !cancelled) {
          setKnowledgePage(page);
          clearInterval(interval);
        }
      } catch (e) {
        console.error('CourseView: knowledge page poll failed:', e);
      }
    }, 3000);

    // Stop polling after 2 minutes — Realtime subscription will handle it anyway
    const timeout = setTimeout(() => clearInterval(interval), 120000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [courseId, loading, course, knowledgePage]);

  // ── Generating state ────────────────────────────────────────────────────────
  if (loading && course?.status === 'generating') {
    return <GeneratingSkeleton topic={course.topic} />;
  }

  // Show skeleton while doing the initial load (before we have a course row)
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="w-8 h-8 text-warmgray-300 animate-spin mb-3" strokeWidth={1.5} />
        <p className="text-sm text-warmgray-400 font-serif">Loading course…</p>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (course?.status === 'error') {
    return (
      <ErrorState
        topic={course.topic}
        message={course.error_message}
        courseId={courseId}
        onBack={onBack}
        onDeleted={onBack}
      />
    );
  }

  // ── Generating (non-loading path — we have a course row but content isn't ready yet) ──
  if (course?.status === 'generating') {
    return <GeneratingSkeleton topic={course.topic} />;
  }

  // ── Not found ───────────────────────────────────────────────────────────────
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

  // ── Ready ───────────────────────────────────────────────────────────────────
  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const completedLessons = Array.from(progressMap.values()).filter(
    (p) => p.status === 'completed',
  ).length;
  const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-warmgray-400 hover:text-ink-600 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
        Back to library
      </button>

      {/* Colour bar */}
      <div
        className={`h-2 rounded-full bg-gradient-to-r ${
          COURSE_COLOR_GRADIENTS[course.cover_color] || COURSE_COLOR_GRADIENTS.terracotta
        } mb-6`}
      />

      {/* Title row + Knowledge Page button */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="font-serif text-3xl md:text-4xl text-ink-700 leading-tight flex-1">
          {course.title}
        </h1>

        {knowledgePage ? (
          <button
            onClick={() => onOpenPage(knowledgePage.id)}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-cream-50 border border-cream-200 text-sm font-medium text-ink-600 hover:bg-cream-200 hover:border-sand-200 transition-all shadow-soft group"
            title={`Open knowledge page: ${knowledgePage.title}`}
          >
            <FileText
              className="w-4 h-4 text-warmgray-400 group-hover:text-terracotta-500 transition-colors"
              strokeWidth={1.5}
            />
            <span className="hidden sm:inline">Knowledge Page</span>
          </button>
        ) : (
          // Knowledge page is still being generated — show a subtle loading indicator
          <div
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-cream-50 border border-cream-200 text-sm text-warmgray-400 select-none"
            title="Knowledge page is being generated…"
          >
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
            <span className="hidden sm:inline">Knowledge Page</span>
          </div>
        )}
      </div>

      <p className="reading-text !text-[1.0625rem] !leading-[1.75] text-warmgray-500 mb-6">
        {course.description}
      </p>

      {/* Metadata chips */}
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

      {/* Progress card */}
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

      {/* Module / lesson list */}
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
                const globalIdx =
                  modules.slice(0, mIdx).reduce((sum, m) => sum + m.lessons.length, 0) + lIdx + 1;

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
