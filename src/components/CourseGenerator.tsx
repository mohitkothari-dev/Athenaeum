import { useState, FormEvent } from 'react';
import {
  Sparkles, ArrowRight, Loader2, Target, Clock, BarChart3, BookOpen,
  FileText, CheckCircle,
} from 'lucide-react';
import { generateCourse, type GenerationParams } from '@/lib/api';

interface CourseGeneratorProps {
  onGenerated: (courseId: string, pageId: string | null) => void;
  onOpenPage?: (pageId: string) => void;
  onCancel: () => void;
}

const knowledgeLevels = ['Beginner', 'Intermediate', 'Advanced'];
const difficulties = ['Easy', 'Medium', 'Hard'];
const timeOptions = ['15 min/day', '30 min/day', '1 hour/day', '2+ hours/day'];

const exampleTopics = [
  'Docker for web developers',
  'Modern art history',
  'Linear algebra fundamentals',
  'Spanish for travelers',
  'Climate science basics',
  'Investing for beginners',
];

// Ordered status messages shown during generation.
// The last two are shown during the knowledge-page phase.
const COURSE_STATUS_MESSAGES = [
  'Designing your curriculum…',
  'Writing lessons…',
  'Creating flashcards…',
  'Building quizzes…',
  'Adding practice exercises…',
];
const PAGE_STATUS_MESSAGE = 'Creating your knowledge page…';

export function CourseGenerator({ onGenerated, onOpenPage, onCancel }: CourseGeneratorProps) {
  const [topic, setTopic] = useState('');
  const [knowledgeLevel, setKnowledgeLevel] = useState('Beginner');
  const [goal, setGoal] = useState('');
  const [timeCommitment, setTimeCommitment] = useState('30 min/day');
  const [difficulty, setDifficulty] = useState('Medium');

  // loading phases: 'idle' | 'course' | 'page' | 'done'
  const [phase, setPhase] = useState<'idle' | 'course' | 'page' | 'done'>('idle');
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');

  // Stored after generation so the success panel can link to both
  const [resultCourseId, setResultCourseId] = useState('');
  const [resultPageId, setResultPageId] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setError('');
    setPhase('course');
    setStatusText(COURSE_STATUS_MESSAGES[0]);

    // Cycle through course-phase messages every 4 s
    let msgIdx = 0;
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % COURSE_STATUS_MESSAGES.length;
      setStatusText(COURSE_STATUS_MESSAGES[msgIdx]);
    }, 4000);

    const params: GenerationParams = {
      topic: topic.trim(),
      knowledge_level: knowledgeLevel,
      goal: goal.trim() || 'Gain a solid understanding of the topic',
      time_commitment: timeCommitment,
      difficulty,
    };

    const result = await generateCourse(params);
    clearInterval(interval);

    if ('error' in result) {
      setError(result.error);
      setPhase('idle');
      setStatusText('');
      return;
    }

    // Course is done — show the page-creation phase briefly so the user
    // knows something more is happening.
    setPhase('page');
    setStatusText(PAGE_STATUS_MESSAGE);

    // The edge function already did both steps; we just show the message
    // for a moment before landing on the success panel.
    await new Promise<void>((resolve) => setTimeout(resolve, 1200));

    setResultCourseId(result.courseId);
    setResultPageId(result.pageId);
    setPhase('done');
  };

  // ── Loading screen (course phase) ────────────────────────────────────────
  if (phase === 'course' || phase === 'page') {
    const isPagePhase = phase === 'page';
    return (
      <div className="max-w-lg mx-auto py-20 text-center animate-fade-in">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full bg-terracotta-50 animate-gentle-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            {isPagePhase ? (
              <FileText
                className="w-10 h-10 text-terracotta-400 animate-gentle-pulse"
                strokeWidth={1.5}
              />
            ) : (
              <Loader2
                className="w-10 h-10 text-terracotta-500 animate-spin"
                strokeWidth={1.5}
              />
            )}
          </div>
        </div>
        <h2 className="font-serif text-2xl text-ink-700 mb-2">
          {isPagePhase ? 'Building your knowledge page' : 'Generating your course'}
        </h2>
        <p className="text-sm text-warmgray-400 font-serif italic">{statusText}</p>
        <p className="text-xs text-warmgray-300 mt-4">
          {isPagePhase
            ? 'Creating a reference page you can edit any time'
            : 'This usually takes 20–40 seconds'}
        </p>
      </div>
    );
  }

  // ── Success panel ─────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <div className="max-w-lg mx-auto py-20 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-sage-600" strokeWidth={1.5} />
        </div>
        <h2 className="font-serif text-2xl text-ink-700 mb-2">Your course is ready</h2>

        {resultPageId ? (
          <p className="text-sm text-warmgray-400 mb-8">
            A knowledge page has been created alongside your course — use it as
            a personal reference as you learn.
          </p>
        ) : (
          <p className="text-sm text-warmgray-400 mb-8">
            Your course has been generated successfully.
          </p>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => onGenerated(resultCourseId, resultPageId)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-terracotta-500 text-cream-50 hover:bg-terracotta-600 font-medium text-sm transition-colors shadow-soft"
          >
            <BookOpen className="w-4 h-4" strokeWidth={1.5} />
            Open Course
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </button>

          {resultPageId && (
            <button
              onClick={() => {
                if (onOpenPage) onOpenPage(resultPageId);
                else onGenerated(resultCourseId, resultPageId);
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-cream-50 border border-cream-200 text-ink-600 hover:bg-cream-200 font-medium text-sm transition-colors"
            >
              <FileText className="w-4 h-4" strokeWidth={1.5} />
              Open Knowledge Page
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-terracotta-50 border border-terracotta-100 mb-4">
          <Sparkles className="w-3.5 h-3.5 text-terracotta-500" strokeWidth={1.5} />
          <span className="text-xs font-medium text-terracotta-600">AI Course Generator</span>
        </div>
        <h1 className="font-serif text-3xl text-ink-700 mb-2">What do you want to learn?</h1>
        <p className="text-sm text-warmgray-400">
          Tell us about your goals, and AI will build a complete course tailored to you.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-cream-50 rounded-xl2 border border-cream-200 p-7 space-y-6">
        {/* Topic */}
        <div>
          <label className="block text-sm font-semibold text-ink-600 mb-2">
            <BookOpen className="w-4 h-4 inline mr-1.5 -mt-0.5" strokeWidth={1.5} />
            Topic
          </label>
          <input
            type="text"
            required
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Docker for web developers"
            className="w-full px-4 py-3 rounded-xl bg-cream-100 border border-cream-200 text-sm text-ink-600 placeholder:text-warmgray-300 focus:outline-none focus:border-sand-300 focus:bg-cream-50 transition-colors"
          />
          <div className="flex flex-wrap gap-2 mt-2.5">
            {exampleTopics.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setTopic(ex)}
                className="px-3 py-1 rounded-full bg-cream-100 border border-cream-200 text-xs text-warmgray-500 hover:bg-cream-200 hover:text-ink-600 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Knowledge level */}
        <div>
          <label className="block text-sm font-semibold text-ink-600 mb-2">
            <BarChart3 className="w-4 h-4 inline mr-1.5 -mt-0.5" strokeWidth={1.5} />
            Current Knowledge Level
          </label>
          <div className="grid grid-cols-3 gap-2">
            {knowledgeLevels.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setKnowledgeLevel(level)}
                className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  knowledgeLevel === level
                    ? 'bg-terracotta-500 text-cream-50 shadow-soft'
                    : 'bg-cream-100 border border-cream-200 text-warmgray-500 hover:bg-cream-200'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Goal */}
        <div>
          <label className="block text-sm font-semibold text-ink-600 mb-2">
            <Target className="w-4 h-4 inline mr-1.5 -mt-0.5" strokeWidth={1.5} />
            What's your goal?{' '}
            <span className="text-warmgray-300 font-normal">(optional)</span>
          </label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Deploy a Next.js application using Docker"
            rows={2}
            className="w-full px-4 py-3 rounded-xl bg-cream-100 border border-cream-200 text-sm text-ink-600 placeholder:text-warmgray-300 focus:outline-none focus:border-sand-300 focus:bg-cream-50 transition-colors resize-none"
          />
        </div>

        {/* Time + Difficulty */}
        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-semibold text-ink-600 mb-2">
              <Clock className="w-4 h-4 inline mr-1.5 -mt-0.5" strokeWidth={1.5} />
              Time Commitment
            </label>
            <select
              value={timeCommitment}
              onChange={(e) => setTimeCommitment(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-cream-100 border border-cream-200 text-sm text-ink-600 focus:outline-none focus:border-sand-300 focus:bg-cream-50 transition-colors cursor-pointer"
            >
              {timeOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink-600 mb-2">
              <BarChart3 className="w-4 h-4 inline mr-1.5 -mt-0.5" strokeWidth={1.5} />
              Preferred Difficulty
            </label>
            <div className="grid grid-cols-3 gap-2">
              {difficulties.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    difficulty === d
                      ? 'bg-terracotta-500 text-cream-50 shadow-soft'
                      : 'bg-cream-100 border border-cream-200 text-warmgray-500 hover:bg-cream-200'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-brick-500 bg-brick-50 border border-brick-100 rounded-xl px-4 py-3 animate-fade-in">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-3 rounded-xl bg-cream-100 border border-cream-200 text-sm font-medium text-warmgray-500 hover:bg-cream-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-terracotta-500 text-cream-50 hover:bg-terracotta-600 font-medium text-sm transition-colors shadow-soft"
          >
            <Sparkles className="w-4 h-4" strokeWidth={1.5} />
            Generate Course
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </form>
    </div>
  );
}
