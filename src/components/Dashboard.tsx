import { useState, useEffect, useCallback } from 'react';
import { Plus, Clock, CheckCircle, BookOpen, Loader2, Trash2, ArrowRight, GraduationCap } from 'lucide-react';
import type { Course } from '@/types';
import { fetchCourses, deleteCourse, fetchCourseProgress } from '@/lib/api';
import { COURSE_COLOR_GRADIENTS } from '@/lib/courseColors';

interface DashboardProps {
  onOpenCourse: (courseId: string) => void;
  onGenerate: () => void;
  onProgress: () => void;
  refreshKey: number;
}

interface CourseProgress {
  course: Course;
  totalLessons: number;
  completedLessons: number;
  percent: number;
}

export function Dashboard({ onOpenCourse, onGenerate, onProgress, refreshKey }: DashboardProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [progressData, setProgressData] = useState<CourseProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCourses();
      setCourses(data);
      const enriched: CourseProgress[] = await Promise.all(
        data.map(async (course) => {
          const { totalLessons, completedLessons, percent } = await fetchCourseProgress(course.id);
          return { course, totalLessons, completedLessons, percent };
        }),
      );
      setProgressData(enriched);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handleDelete = async (courseId: string) => {
    await deleteCourse(courseId);
    setConfirmDelete(null);
    load();
  };

  const inProgress = progressData.filter((p) => p.completedLessons > 0 && p.percent < 100);
  const completed = progressData.filter((p) => p.percent === 100 && p.totalLessons > 0);
  const notStarted = progressData.filter((p) => p.completedLessons === 0);

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-ink-700 mb-1">Your Library</h1>
          <p className="text-sm text-warmgray-400">
            {courses.length} {courses.length === 1 ? 'course' : 'courses'} · {completed.length} completed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onProgress}
            className="px-4 py-2.5 rounded-xl bg-cream-100 border border-cream-200 text-sm font-medium text-ink-600 hover:bg-cream-200 transition-colors"
          >
            Progress
          </button>
          <button
            onClick={onGenerate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-terracotta-500 text-cream-50 hover:bg-terracotta-600 font-medium text-sm transition-colors shadow-soft"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            New Course
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 className="w-8 h-8 text-warmgray-300 animate-spin mb-3" strokeWidth={1.5} />
          <p className="text-sm text-warmgray-400 font-serif">Loading your courses...</p>
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-20 max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-cream-200 flex items-center justify-center mx-auto mb-5">
            <GraduationCap className="w-8 h-8 text-warmgray-300" strokeWidth={1} />
          </div>
          <h2 className="font-serif text-2xl text-ink-700 mb-2">Your library is empty</h2>
          <p className="text-sm text-warmgray-400 mb-6">
            Generate your first AI-powered course. Just enter a topic and let Athenaeum build a
            complete learning experience for you.
          </p>
          <button
            onClick={onGenerate}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-terracotta-500 text-cream-50 hover:bg-terracotta-600 font-medium text-sm transition-colors shadow-soft"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            Generate a course
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {inProgress.length > 0 && (
            <section>
              <h2 className="font-serif text-xl text-ink-700 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gold-500" strokeWidth={1.5} />
                In Progress
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {inProgress.map((p) => (
                  <CourseCard
                    key={p.course.id}
                    progress={p}
                    colorClass={COURSE_COLOR_GRADIENTS[p.course.cover_color] || COURSE_COLOR_GRADIENTS.terracotta}
                    onOpen={() => onOpenCourse(p.course.id)}
                    onDelete={() => setConfirmDelete(p.course.id)}
                    confirmDelete={confirmDelete === p.course.id}
                    onConfirmDelete={() => handleDelete(p.course.id)}
                    onCancelDelete={() => setConfirmDelete(null)}
                  />
                ))}
              </div>
            </section>
          )}

          {notStarted.length > 0 && (
            <section>
              <h2 className="font-serif text-xl text-ink-700 mb-4 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-terracotta-500" strokeWidth={1.5} />
                Not Started
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {notStarted.map((p) => (
                  <CourseCard
                    key={p.course.id}
                    progress={p}
                    colorClass={COURSE_COLOR_GRADIENTS[p.course.cover_color] || COURSE_COLOR_GRADIENTS.terracotta}
                    onOpen={() => onOpenCourse(p.course.id)}
                    onDelete={() => setConfirmDelete(p.course.id)}
                    confirmDelete={confirmDelete === p.course.id}
                    onConfirmDelete={() => handleDelete(p.course.id)}
                    onCancelDelete={() => setConfirmDelete(null)}
                  />
                ))}
              </div>
            </section>
          )}

          {completed.length > 0 && (
            <section>
              <h2 className="font-serif text-xl text-ink-700 mb-4 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-sage-600" strokeWidth={1.5} />
                Completed
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {completed.map((p) => (
                  <CourseCard
                    key={p.course.id}
                    progress={p}
                    colorClass={COURSE_COLOR_GRADIENTS[p.course.cover_color] || COURSE_COLOR_GRADIENTS.terracotta}
                    onOpen={() => onOpenCourse(p.course.id)}
                    onDelete={() => setConfirmDelete(p.course.id)}
                    confirmDelete={confirmDelete === p.course.id}
                    onConfirmDelete={() => handleDelete(p.course.id)}
                    onCancelDelete={() => setConfirmDelete(null)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

interface CourseCardProps {
  progress: CourseProgress;
  colorClass: string;
  onOpen: () => void;
  onDelete: () => void;
  confirmDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

function CourseCard({
  progress,
  colorClass,
  onOpen,
  onDelete,
  confirmDelete,
  onConfirmDelete,
  onCancelDelete,
}: CourseCardProps) {
  const { course, totalLessons, completedLessons, percent } = progress;

  return (
    <div className="group bg-cream-50 rounded-xl2 border border-cream-200 overflow-hidden hover:border-sand-200 hover:shadow-card transition-all">
      <div className={`h-2 bg-gradient-to-r ${colorClass}`} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-serif text-lg text-ink-700 leading-snug mb-1">{course.title}</h3>
            <p className="text-sm text-warmgray-400 line-clamp-2 leading-relaxed">{course.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-warmgray-400 mb-4">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" strokeWidth={1.5} />
            {totalLessons} lessons
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
            {course.estimated_duration || 'Flexible'}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-cream-200 text-warmgray-500 font-medium">
            {course.difficulty}
          </span>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-1.5 bg-cream-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-terracotta-400 rounded-full transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-warmgray-500 tabular-nums">{percent}%</span>
        </div>

        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onConfirmDelete}
              className="flex-1 py-2 rounded-lg bg-brick-100 text-brick-600 text-sm font-medium hover:bg-brick-200 transition-colors"
            >
              Delete course
            </button>
            <button
              onClick={onCancelDelete}
              className="flex-1 py-2 rounded-lg bg-cream-200 text-warmgray-500 text-sm font-medium hover:bg-cream-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <button
              onClick={onOpen}
              className="flex items-center gap-1.5 text-sm font-medium text-terracotta-600 group-hover:gap-2.5 transition-all"
            >
              {completedLessons > 0 ? 'Continue' : 'Start'}
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </button>
            <button
              onClick={onDelete}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-warmgray-300 hover:text-brick-500 hover:bg-brick-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
