import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import {
  Sparkles,
  ArrowRight,
  BookOpen,
  FileText,
  Pencil,
  Clock,
  ChevronRight,
  Loader2,
  GraduationCap,
  StickyNote,
  ChevronDown,
  Target,
  BarChart3,
} from 'lucide-react';
import type { AppDocument, CourseWithProgress } from '@/types';
import type { CanvasDocument } from '@/types/canvas';
import { COURSE_COLOR_GRADIENTS } from '@/lib/courseColors';

// ─── Intent Types ────────────────────────────────────────────────────────────

type LearningIntent = 'course' | 'course+page' | 'notes' | 'practice' | 'page' | 'canvas';

interface Intent {
  id: LearningIntent;
  label: string;
  description: string;
  icon: React.ReactNode;
  available: boolean;
  recommended?: boolean;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface HomePageProps {
  userEmail: string;
  dashboardProgress: CourseWithProgress[];
  dashboardLoading: boolean;
  dashboardHasLoaded: boolean;
  documents: AppDocument[];
  docsLoading: boolean;
  canvases: CanvasDocument[];
  canvasesLoading: boolean;
  // Navigation callbacks
  onOpenCourse: (courseId: string) => void;
  onNavigateCourses: () => void;
  onGenerateCourse: (
    topic: string,
    goal: string,
    knowledgeLevel: string,
    timeCommitment: string,
    difficulty: string,
    includeKnowledgePage: boolean
  ) => void;
  generatingCourse: boolean;
  generationError: string;
  onOpenDocument: (documentId: string) => void;
  onCreateDocument: (title: string) => Promise<void>;
  onOpenCanvas: (canvasId: string) => void;
  onCreateCanvas: () => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting(email: string): string {
  const hour = new Date().getHours();
  const name = email.split('@')[0];
  const displayName = name.charAt(0).toUpperCase() + name.slice(1);
  if (hour < 12) return `Good morning, ${displayName}.`;
  if (hour < 17) return `Good afternoon, ${displayName}.`;
  return `Good evening, ${displayName}.`;
}

const INTENTS: Intent[] = [
  {
    id: 'course+page',
    label: 'Course + Knowledge',
    description: 'Full course with reference page',
    icon: <><GraduationCap className="w-4 h-4" strokeWidth={1.5} /><FileText className="w-3 h-3 -ml-1" strokeWidth={1.5} /></>,
    available: true,
    recommended: true,
  },
  {
    id: 'course',
    label: 'Course',
    description: 'Structured learning path',
    icon: <GraduationCap className="w-4 h-4" strokeWidth={1.5} />,
    available: true,
  },
  {
    id: 'notes',
    label: 'Notes',
    description: 'Quick summary',
    icon: <StickyNote className="w-4 h-4" strokeWidth={1.5} />,
    available: false,
  },
  {
    id: 'practice',
    label: 'Practice',
    description: 'Quiz & exercises',
    icon: <Sparkles className="w-4 h-4" strokeWidth={1.5} />,
    available: false,
  },
];

const EXAMPLE_PROMPTS = [
  'Docker for web developers',
  'Linear algebra fundamentals',
  'Spanish for travelers',
  'Climate science basics',
  'Investing for beginners',
  'Modern art history',
];

// ─── Generation UI ─────────────────────────────────────────────────────────────

const GENERATION_STATUS_MESSAGES = [
  'Designing your curriculum…',
  'Writing lessons…',
  'Creating flashcards…',
  'Building quizzes…',
  'Adding practice exercises…',
  'Finalizing your course…',
];

function estimateGenerationSeconds(
  timeCommitment: string,
  difficulty: string,
  knowledgeLevel: string,
  includePage: boolean,
): { low: number; high: number; label: string } {
  let low = 22;
  let high = 35;

  switch (timeCommitment) {
    case '15 min/day':
      low = 18; high = 28; break;
    case '30 min/day':
      low = 22; high = 35; break;
    case '1 hour/day':
      low = 28; high = 42; break;
    case '2+ hours/day':
      low = 35; high = 55; break;
  }

  if (difficulty === 'Easy') { low -= 3; high -= 5; }
  if (difficulty === 'Hard') { low += 5; high += 10; }

  if (knowledgeLevel === 'Advanced') { low += 3; high += 5; }
  if (knowledgeLevel === 'Beginner') { low += 1; high += 2; }

  if (includePage) { low += 8; high += 12; }

  low = Math.max(15, low);
  high = Math.max(low + 5, high);
  high = Math.min(70, high);

  return { low, high, label: `${low}–${high} seconds` };
}

function GenerationScreen({
  timeCommitment,
  difficulty,
  knowledgeLevel,
  includePage,
}: {
  timeCommitment: string;
  difficulty: string;
  knowledgeLevel: string;
  includePage: boolean;
}) {
  const [msgIdx, setMsgIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const estimate = estimateGenerationSeconds(timeCommitment, difficulty, knowledgeLevel, includePage);

  useEffect(() => {
    const id = setInterval(() => setMsgIdx((i) => (i + 1) % GENERATION_STATUS_MESSAGES.length), 3500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="max-w-lg mx-auto py-24 text-center animate-fade-in">
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div className="absolute inset-0 rounded-full bg-terracotta-50 animate-gentle-pulse" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-terracotta-500 animate-spin" strokeWidth={1.5} />
        </div>
      </div>
      <h2 className="font-serif text-2xl text-ink-700 mb-2">Generating your course</h2>
      <p className="text-sm text-warmgray-400 font-serif italic min-h-[20px] transition-all">
        {GENERATION_STATUS_MESSAGES[msgIdx]}
      </p>
      <p className="text-xs text-warmgray-300 mt-4">
        Estimated time: {estimate.label} {includePage && <span className="opacity-70">· includes knowledge page</span>}
      </p>
      <p className="text-[11px] text-warmgray-300 mt-1 tabular-nums">
        Elapsed: {elapsed}s{elapsed > estimate.high ? ' · almost there…' : ''}
      </p>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ContinueLearningCard({
  progress,
  onOpen,
}: {
  progress: CourseWithProgress;
  onOpen: () => void;
}) {
  const { course, totalLessons, completedLessons, percent } = progress;
  const colorClass =
    COURSE_COLOR_GRADIENTS[course.cover_color] || COURSE_COLOR_GRADIENTS.terracotta;

  return (
    <button
      onClick={onOpen}
      className="group text-left w-full bg-cream-50 rounded-xl2 border border-cream-200 overflow-hidden hover:border-sand-200 hover:shadow-card transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-400 focus-visible:ring-offset-2"
      aria-label={`Continue course: ${course.title}, ${percent}% complete`}
    >
      <div className={`h-1.5 bg-gradient-to-r ${colorClass}`} />
      <div className="p-4">
        <p className="font-serif text-base text-ink-700 leading-snug mb-1 line-clamp-2">
          {course.title}
        </p>
        <p className="text-xs text-warmgray-400 mb-3">
          {completedLessons} of {totalLessons} lessons · {percent}% complete
        </p>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1 bg-cream-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-terracotta-400 rounded-full transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-terracotta-500 flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
            {percent === 0 ? 'Start' : 'Continue'}
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
          </span>
        </div>
      </div>
    </button>
  );
}

function RecentDocCard({
  doc,
  onOpen,
}: {
  doc: AppDocument;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="group text-left w-full bg-cream-50 rounded-xl border border-cream-200 p-3.5 hover:border-sand-200 hover:shadow-card transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-400 focus-visible:ring-offset-2"
      aria-label={`Open page: ${doc.title}`}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-base leading-none mt-0.5 flex-shrink-0" role="img" aria-hidden="true">
          {doc.icon || '📝'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-600 truncate">{doc.title || 'Untitled'}</p>
          <p className="text-xs text-warmgray-400 mt-0.5">
            {new Date(doc.updated_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-warmgray-300 group-hover:text-warmgray-500 flex-shrink-0 mt-0.5 transition-colors" strokeWidth={2} />
      </div>
    </button>
  );
}

function RecentCanvasCard({
  canvas,
  onOpen,
}: {
  canvas: CanvasDocument;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="group text-left w-full bg-cream-50 rounded-xl border border-cream-200 p-3.5 hover:border-sand-200 hover:shadow-card transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-400 focus-visible:ring-offset-2"
      aria-label={`Open canvas: ${canvas.title}`}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-base leading-none mt-0.5 flex-shrink-0" role="img" aria-hidden="true">
          🎨
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-600 truncate">{canvas.title || 'Untitled Canvas'}</p>
          <p className="text-xs text-warmgray-400 mt-0.5">
            {new Date(canvas.updated_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-warmgray-300 group-hover:text-warmgray-500 flex-shrink-0 mt-0.5 transition-colors" strokeWidth={2} />
      </div>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function HomePage({
  userEmail,
  dashboardProgress,
  dashboardLoading,
  dashboardHasLoaded,
  documents,
  docsLoading,
  canvases,
  canvasesLoading,
  onOpenCourse,
  onNavigateCourses,
  onGenerateCourse,
  generatingCourse,
  generationError,
  onOpenDocument,
  onCreateDocument,
  onOpenCanvas,
  onCreateCanvas,
}: HomePageProps) {
  const [input, setInput] = useState('');
  const [intent, setIntent] = useState<LearningIntent>('course+page');
  const [showIntentPicker, setShowIntentPicker] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  
  // Customization fields
  const [knowledgeLevel, setKnowledgeLevel] = useState('Beginner');
  const [goal, setGoal] = useState('');
  const [timeCommitment, setTimeCommitment] = useState('30 min/day');
  const [difficulty, setDifficulty] = useState('Medium');
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  // Show intent picker once user starts typing
  useEffect(() => {
    setShowIntentPicker(input.trim().length > 0);
  }, [input]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!input.trim() || generatingCourse) return;

    // 'course+page' also generates a knowledge page; plain 'course' skips it.
    // Unavailable intents are disabled in the picker and can't be selected.
    const finalGoal = goal.trim() || 'Gain a solid understanding of the topic';

    onGenerateCourse(
      input.trim(),
      finalGoal,
      knowledgeLevel,
      timeCommitment,
      difficulty,
      intent === 'course+page'
    );
  };

  const handleExampleClick = (example: string) => {
    setInput(example);
    textareaRef.current?.focus();
  };

  // Derived data
  const recentCourses = dashboardProgress
    .filter((p) => p.completedLessons > 0 || p.totalLessons > 0)
    .sort((a, b) => {
      // Sort: in-progress first, then not-started, completed last
      if (a.percent > 0 && a.percent < 100 && !(b.percent > 0 && b.percent < 100)) return -1;
      if (b.percent > 0 && b.percent < 100 && !(a.percent > 0 && a.percent < 100)) return 1;
      return 0;
    })
    .slice(0, 3);

  const recentDocs = [...documents]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 3);

  const recentCanvases = [...canvases]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 2);

  const hasRecentKnowledge = recentDocs.length > 0 || recentCanvases.length > 0;
  const showContinueLearning = dashboardHasLoaded && recentCourses.length > 0;
  const loadingContinue = dashboardLoading && !dashboardHasLoaded;

  // Generative loading state — replaces the whole page while generating
  if (generatingCourse) {
    return (
      <GenerationScreen
        timeCommitment={timeCommitment}
        difficulty={difficulty}
        knowledgeLevel={knowledgeLevel}
        includePage={intent === 'course+page'}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-10 pb-10">

      {/* ── Greeting ── */}
      <div style={{ animationDelay: '0ms', opacity: 0 }} className="animate-fade-in pt-2">
        <h1 className="font-serif text-3xl text-ink-700 mb-1">
          {getGreeting(userEmail)}
        </h1>
        <p className="text-sm text-warmgray-400">What would you like to learn today?</p>
      </div>

      {/* ── Main Input ── */}
      <div style={{ animationDelay: '80ms', opacity: 0 }} className="animate-fade-in">
        <div className="bg-cream-50 rounded-xl2 border border-cream-200 shadow-soft focus-within:border-sand-300 focus-within:shadow-card transition-all">
          {/* Textarea */}
          <div className="px-5 pt-5 pb-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to learn… e.g. &quot;Teach me Docker from beginner level. I want to deploy a Next.js application.&quot;"
              rows={2}
              aria-label="Learning topic or goal"
              className="w-full bg-transparent text-base text-ink-700 placeholder:text-warmgray-300 focus:outline-none resize-none leading-relaxed scrollbar-thin"
            />
          </div>

          {/* Intent picker — revealed when input is non-empty */}
          {showIntentPicker && (
            <div className="px-5 pb-3 animate-fade-in space-y-3">
              <div role="group" aria-label="What would you like to create?">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-warmgray-400 mb-2.5">
                  What would you like to create?
                </p>
                <div className="flex flex-wrap gap-2">
                  {INTENTS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!item.available}
                      onClick={() => setIntent(item.id)}
                      title={item.available ? item.description : `${item.description} — coming soon`}
                      aria-pressed={intent === item.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-400 focus-visible:ring-offset-1 ${
                        !item.available
                          ? 'opacity-40 cursor-not-allowed text-warmgray-400 bg-cream-100 border border-cream-200'
                          : intent === item.id
                          ? 'bg-terracotta-500 text-cream-50 shadow-soft'
                          : 'bg-cream-200 text-warmgray-600 hover:bg-cream-300 hover:text-ink-600'
                      }`}
                    >
                      {item.icon}
                      {item.label}
                      {item.recommended && intent !== item.id && (
                        <span className="text-[10px] font-normal bg-gold-100 text-gold-700 px-1.5 py-0.5 rounded">
                          Recommended
                        </span>
                      )}
                      {!item.available && (
                        <span className="text-[10px] font-normal opacity-70 ml-0.5">Soon</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Personalization section with progressive disclosure */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowCustomize(!showCustomize)}
                  className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-warmgray-400 hover:text-warmgray-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-400 rounded"
                >
                  <span>Personalize your learning</span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${showCustomize ? 'rotate-180' : ''}`}
                    strokeWidth={2.5}
                  />
                </button>

                {showCustomize && (
                  <div className="mt-3 space-y-4 animate-fade-in">
                    {/* Knowledge Level */}
                    <div>
                      <label className="block text-xs font-semibold text-ink-600 mb-2">
                        <BarChart3 className="w-3 h-3 inline mr-1 -mt-0.5" strokeWidth={1.5} />
                        Current Knowledge Level
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {['Beginner', 'Intermediate', 'Advanced'].map((level) => (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setKnowledgeLevel(level)}
                            className={`py-2 rounded-lg text-xs font-medium transition-colors ${
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
                      <label className="block text-xs font-semibold text-ink-600 mb-2">
                        <Target className="w-3 h-3 inline mr-1 -mt-0.5" strokeWidth={1.5} />
                        Goal <span className="text-warmgray-300 font-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                        placeholder="e.g. Deploy a Next.js application"
                        className="w-full px-3 py-2 rounded-lg bg-cream-100 border border-cream-200 text-xs text-ink-600 placeholder:text-warmgray-300 focus:outline-none focus:border-sand-300 focus:bg-cream-50 transition-colors"
                      />
                    </div>

                    {/* Time + Difficulty */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-ink-600 mb-2">
                          <Clock className="w-3 h-3 inline mr-1 -mt-0.5" strokeWidth={1.5} />
                          Time Commitment
                        </label>
                        <select
                          value={timeCommitment}
                          onChange={(e) => setTimeCommitment(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-cream-100 border border-cream-200 text-xs text-ink-600 focus:outline-none focus:border-sand-300 focus:bg-cream-50 transition-colors cursor-pointer"
                        >
                          <option value="15 min/day">15 min/day</option>
                          <option value="30 min/day">30 min/day</option>
                          <option value="1 hour/day">1 hour/day</option>
                          <option value="2+ hours/day">2+ hours/day</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-ink-600 mb-2">
                          <BarChart3 className="w-3 h-3 inline mr-1 -mt-0.5" strokeWidth={1.5} />
                          Difficulty
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {['Easy', 'Medium', 'Hard'].map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setDifficulty(d)}
                              className={`py-2 rounded-lg text-[11px] font-medium transition-colors ${
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
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action bar */}
          <div className="px-4 py-3 border-t border-cream-200 flex items-center justify-between gap-3">
            {/* Example prompts — shown when input is empty */}
            {!showIntentPicker ? (
              <div className="flex flex-wrap gap-2 flex-1" role="list" aria-label="Example topics">
                {EXAMPLE_PROMPTS.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => handleExampleClick(ex)}
                    role="listitem"
                    className="px-2.5 py-1 rounded-full bg-cream-100 border border-cream-200 text-xs text-warmgray-500 hover:bg-cream-200 hover:text-ink-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-400"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-warmgray-300 flex-1">
                Press <kbd className="px-1 py-0.5 rounded bg-cream-200 text-warmgray-500 font-mono text-[11px]">Enter</kbd> to generate · Shift+Enter for new line
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!input.trim() || generatingCourse}
              aria-label="Generate learning content"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-terracotta-500 text-cream-50 hover:bg-terracotta-600 font-medium text-sm transition-colors shadow-soft disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-400 focus-visible:ring-offset-2"
            >
              <Sparkles className="w-4 h-4" strokeWidth={1.5} />
              Generate
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Error */}
        {generationError && (
          <p className="mt-3 text-sm text-brick-500 bg-brick-50 border border-brick-100 rounded-xl px-4 py-3 animate-fade-in" role="alert">
            {generationError}
          </p>
        )}
      </div>

      {/* ── Quick-action tiles ── */}
      <div style={{ animationDelay: '160ms', opacity: 0 }} className="animate-fade-in">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickActionTile
            icon={<GraduationCap className="w-5 h-5" strokeWidth={1.5} />}
            label="All Courses"
            onClick={onNavigateCourses}
          />
          <QuickActionTile
            icon={<BookOpen className="w-5 h-5" strokeWidth={1.5} />}
            label="New Course"
            onClick={() => {
              // Scroll to top to focus on the input
              window.scrollTo({ top: 0, behavior: 'smooth' });
              textareaRef.current?.focus();
            }}
          />
          <QuickActionTile
            icon={<FileText className="w-5 h-5" strokeWidth={1.5} />}
            label="New Page"
            onClick={() => onCreateDocument('Untitled')}
          />
          <QuickActionTile
            icon={<Pencil className="w-5 h-5" strokeWidth={1.5} />}
            label="New Canvas"
            onClick={onCreateCanvas}
          />
        </div>
      </div>

      {/* ── Continue Learning ── */}
      {(loadingContinue || showContinueLearning) && (
        <section
          style={{ animationDelay: '220ms', opacity: 0 }}
          className="animate-fade-in"
          aria-labelledby="continue-learning-heading"
        >
          <div className="flex items-center justify-between mb-4">
            <h2
              id="continue-learning-heading"
              className="font-serif text-xl text-ink-700 flex items-center gap-2"
            >
              <Clock className="w-4 h-4 text-gold-500" strokeWidth={1.5} aria-hidden="true" />
              Continue Learning
            </h2>
            <button
              onClick={onNavigateCourses}
              className="text-xs text-warmgray-400 hover:text-terracotta-500 font-medium transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-400 rounded"
              aria-label="View all courses"
            >
              View all
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>

          {loadingContinue ? (
            <div className="flex items-center gap-2 py-6 text-sm text-warmgray-400">
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} aria-hidden="true" />
              <span>Loading your courses...</span>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentCourses.map((p) => (
                <ContinueLearningCard
                  key={p.course.id}
                  progress={p}
                  onOpen={() => onOpenCourse(p.course.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Recent Knowledge ── */}
      {(hasRecentKnowledge || docsLoading || canvasesLoading) && (
        <section
          style={{ animationDelay: '290ms', opacity: 0 }}
          className="animate-fade-in"
          aria-labelledby="recent-knowledge-heading"
        >
          <h2
            id="recent-knowledge-heading"
            className="font-serif text-xl text-ink-700 flex items-center gap-2 mb-4"
          >
            <FileText className="w-4 h-4 text-warmgray-400" strokeWidth={1.5} aria-hidden="true" />
            Recent Knowledge
          </h2>

          {docsLoading || canvasesLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-warmgray-400">
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} aria-hidden="true" />
              <span>Loading...</span>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentDocs.map((doc) => (
                <RecentDocCard
                  key={doc.id}
                  doc={doc}
                  onOpen={() => onOpenDocument(doc.id)}
                />
              ))}
              {recentCanvases.map((canvas) => (
                <RecentCanvasCard
                  key={canvas.id}
                  canvas={canvas}
                  onOpen={() => onOpenCanvas(canvas.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ─── Quick Action Tile ────────────────────────────────────────────────────────

function QuickActionTile({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className="group flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-xl bg-cream-50 border border-cream-200 text-warmgray-500 hover:border-sand-200 hover:bg-cream-100 hover:text-ink-600 hover:shadow-soft transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-400 focus-visible:ring-offset-2"
    >
      <span className="text-warmgray-400 group-hover:text-terracotta-500 transition-colors" aria-hidden="true">
        {icon}
      </span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
