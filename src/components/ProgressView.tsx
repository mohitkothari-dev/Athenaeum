import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, Clock, Award, Loader2, ArrowRight, Flame } from 'lucide-react';
import type { Course, QuizResult } from '@/types';
import { fetchCourses, fetchLessonProgress, fetchQuizResults } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface ProgressViewProps {
  userId: string;
  onBack: () => void;
  onOpenCourse: (courseId: string) => void;
}

interface CourseStat {
  course: Course;
  totalLessons: number;
  completedLessons: number;
  inProgressLessons: number;
  percent: number;
}

export function ProgressView({ userId, onBack, onOpenCourse }: ProgressViewProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseStats, setCourseStats] = useState<CourseStat[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const courseData = await fetchCourses();
      setCourses(courseData);

      const stats: CourseStat[] = [];
      let allQuizResults: QuizResult[] = [];

      for (const course of courseData) {
        const progress = await fetchLessonProgress(course.id);
        const { count: total } = await supabase
          .from('lessons')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', course.id);

        const completed = Array.from(progress.values()).filter((p) => p.status === 'completed').length;
        const inProgress = Array.from(progress.values()).filter((p) => p.status === 'in_progress').length;
        const t = total ?? 0;
        stats.push({
          course,
          totalLessons: t,
          completedLessons: completed,
          inProgressLessons: inProgress,
          percent: t > 0 ? Math.round((completed / t) * 100) : 0,
        });

        const quizzes = await fetchQuizResults(course.id);
        allQuizResults = [...allQuizResults, ...quizzes];
      }

      setCourseStats(stats);
      setQuizResults(allQuizResults.sort((a, b) => b.created_at.localeCompare(a.created_at)));

      const { data: progressData } = await supabase
        .from('lesson_progress')
        .select('completed_at')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

      if (progressData && progressData.length > 0) {
        const dates = progressData
          .map((p: { completed_at: string | null }) => p.completed_at)
          .filter(Boolean)
          .map((d: string | null) => (d ? d.split('T')[0] : ''));
        const uniqueDates = [...new Set(dates)];
        let streakCount = 0;
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        if (uniqueDates.includes(today) || uniqueDates.includes(yesterday)) {
          let checkDate = uniqueDates.includes(today) ? today : yesterday;
          for (const d of uniqueDates) {
            if (d === checkDate) {
              streakCount++;
              checkDate = new Date(Date.parse(checkDate) - 86400000).toISOString().split('T')[0];
            }
          }
        }
        setStreak(streakCount);
      }
    } catch (err) {
      console.error('Failed to load progress:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const totalLessons = courseStats.reduce((sum, s) => sum + s.totalLessons, 0);
  const totalCompleted = courseStats.reduce((sum, s) => sum + s.completedLessons, 0);
  const totalInProgress = courseStats.reduce((sum, s) => sum + s.inProgressLessons, 0);
  const totalQuizScore = quizResults.reduce((sum, r) => sum + r.score, 0);
  const totalQuizPossible = quizResults.reduce((sum, r) => sum + r.total, 0);
  const avgQuizPercent = totalQuizPossible > 0 ? Math.round((totalQuizScore / totalQuizPossible) * 100) : 0;

  const stats = [
    { label: 'Lessons Completed', value: `${totalCompleted}`, sub: `of ${totalLessons} total`, icon: CheckCircle, color: 'text-sage-600', bg: 'bg-sage-50' },
    { label: 'In Progress', value: `${totalInProgress}`, sub: 'lessons started', icon: Clock, color: 'text-gold-500', bg: 'bg-gold-50' },
    { label: 'Quiz Average', value: `${avgQuizPercent}%`, sub: `${quizResults.length} attempts`, icon: Award, color: 'text-terracotta-500', bg: 'bg-terracotta-50' },
    { label: 'Day Streak', value: `${streak}`, sub: streak === 1 ? 'day in a row' : 'days in a row', icon: Flame, color: 'text-brick-500', bg: 'bg-brick-50' },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="w-8 h-8 text-warmgray-300 animate-spin mb-3" strokeWidth={1.5} />
        <p className="text-sm text-warmgray-400 font-serif">Loading your progress...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-warmgray-400 hover:text-ink-600 transition-colors mb-6"
      >
        <ArrowRight className="w-4 h-4 rotate-180" strokeWidth={1.5} />
        Back to library
      </button>

      <h1 className="font-serif text-3xl text-ink-700 mb-1">Your Progress</h1>
      <p className="text-sm text-warmgray-400 mb-8">
        {totalCompleted} lessons completed · {quizResults.length} quizzes taken
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-cream-50 rounded-xl2 border border-cream-200 p-5 animate-fade-in"
              style={{ animationDelay: `${i * 60}ms`, opacity: 0 }}
            >
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${stat.color}`} strokeWidth={1.5} />
              </div>
              <p className="font-serif text-2xl text-ink-700 leading-none mb-1">{stat.value}</p>
              <p className="text-xs font-medium text-ink-600 mb-0.5">{stat.label}</p>
              <p className="text-xs text-warmgray-400">{stat.sub}</p>
            </div>
          );
        })}
      </div>

      <h2 className="font-serif text-xl text-ink-700 mb-4">Course Progress</h2>
      <div className="space-y-3 mb-10">
        {courseStats.map((stat, i) => (
          <button
            key={stat.course.id}
            onClick={() => onOpenCourse(stat.course.id)}
            className="group w-full text-left p-5 bg-cream-50 rounded-xl2 border border-cream-200 hover:border-sand-200 hover:shadow-card transition-all animate-fade-in"
            style={{ animationDelay: `${i * 60}ms`, opacity: 0 }}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-serif text-lg text-ink-700 group-hover:text-terracotta-600 transition-colors">
                  {stat.course.title}
                </h3>
                <p className="text-xs text-warmgray-400 mt-0.5">
                  {stat.completedLessons} completed · {stat.inProgressLessons} in progress · {stat.totalLessons} total
                </p>
              </div>
              <span className="font-serif text-2xl text-terracotta-500 tabular-nums">{stat.percent}%</span>
            </div>
            <div className="h-2 bg-cream-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-terracotta-400 rounded-full transition-all duration-500"
                style={{ width: `${stat.percent}%` }}
              />
            </div>
          </button>
        ))}
      </div>

      {quizResults.length > 0 && (
        <>
          <h2 className="font-serif text-xl text-ink-700 mb-4">Recent Quiz Results</h2>
          <div className="space-y-2.5">
            {quizResults.slice(0, 10).map((result, i) => {
              const course = courses.find((c) => c.id === result.course_id);
              const percent = Math.round((result.score / result.total) * 100);
              const isPassing = percent >= 70;
              return (
                <div
                  key={result.id}
                  className="flex items-center gap-4 p-4 bg-cream-50 rounded-xl border border-cream-200 animate-fade-in"
                  style={{ animationDelay: `${i * 40}ms`, opacity: 0 }}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isPassing ? 'bg-sage-100' : 'bg-gold-50'}`}>
                    {isPassing ? (
                      <CheckCircle className="w-5 h-5 text-sage-600" strokeWidth={1.5} />
                    ) : (
                      <Clock className="w-5 h-5 text-gold-500" strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-600 truncate">{course?.title || 'Course'}</p>
                    <p className="text-xs text-warmgray-400">{new Date(result.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-serif text-lg text-ink-700 tabular-nums">{result.score}/{result.total}</p>
                    <p className={`text-xs font-medium ${isPassing ? 'text-sage-600' : 'text-gold-500'}`}>{percent}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
