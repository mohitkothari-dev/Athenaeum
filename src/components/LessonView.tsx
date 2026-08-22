import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, ArrowRight, Clock, CheckCircle, BookOpen,
  Zap, Smile, Layers, ListChecks, Wrench, Loader2,
  Check, X, RotateCw, Target, Lightbulb, FileText,
  BookMarked,
} from 'lucide-react';
import type { Course, Module, Lesson, LearningMode, AppDocument } from '@/types';
import {
  fetchCourseWithModules, fetchLessonProgress, updateLessonProgress,
  saveQuizResult, recordFlashcardReview,
  fetchDocumentByCourseId, waitForCourseDocument, saveToPage,
} from '@/lib/api';

interface LessonViewProps {
  courseId: string;
  lessonId: string;
  onBack: () => void;
  onOpenLesson: (courseId: string, lessonId: string) => void;
  /** Called after a save-to-page so App.tsx can refresh documents state */
  onPageUpdated?: (doc: AppDocument) => void;
  /** Navigate to the knowledge page */
  onOpenPage?: (documentId: string) => void;
}

const modes: { id: LearningMode; label: string; icon: typeof BookOpen }[] = [
  { id: 'read',      label: 'Read',       icon: BookOpen  },
  { id: 'summary',   label: 'Summary',    icon: Zap       },
  { id: 'eli10',     label: 'ELI10',      icon: Smile     },
  { id: 'flashcards',label: 'Flashcards', icon: Layers    },
  { id: 'quiz',      label: 'Quiz',       icon: ListChecks},
  { id: 'practice',  label: 'Practice',   icon: Wrench    },
];

// Sections available in the knowledge page — must match buildPageMarkdown() headings
const PAGE_SECTIONS = [
  'My Notes',
  'Key Concepts',
  'Important Terms',
  'Examples',
  'Common Mistakes',
  'Questions',
  'Resources',
];

export function LessonView({
  courseId, lessonId, onBack, onOpenLesson, onPageUpdated, onOpenPage,
}: LessonViewProps) {
  const [course,         setCourse        ] = useState<Course | null>(null);
  const [modules,        setModules       ] = useState<Module[]>([]);
  const [lesson,         setLesson        ] = useState<Lesson | null>(null);
  const [progressStatus, setProgressStatus] = useState<string>('not_started');
  const [loading,        setLoading       ] = useState(true);
  const [activeMode,     setActiveMode    ] = useState<LearningMode>('read');
  const [markedInProgress, setMarkedInProgress] = useState(false);

  // Knowledge-page state
  const [knowledgePage, setKnowledgePage] = useState<AppDocument | null>(null);

  // Save-to-Page panel state
  const [savePanel,      setSavePanel    ] = useState(false);
  const [selectedText,   setSelectedText ] = useState('');
  const [saveSection,    setSaveSection  ] = useState('My Notes');
  const [saving,         setSaving       ] = useState(false);
  const [saveMsg,        setSaveMsg      ] = useState<string | null>(null);
  const [saveError,      setSaveError    ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ course: c, modules: mods }, progress, page] = await Promise.all([
        fetchCourseWithModules(courseId),
        fetchLessonProgress(courseId),
        fetchDocumentByCourseId(courseId),
      ]);
      setCourse(c);
      setModules(mods);
      setKnowledgePage(page);

      const allLessons = mods.flatMap((m) => m.lessons);
      setLesson(allLessons.find((l) => l.id === lessonId) ?? null);

      const p = progress.get(lessonId);
      setProgressStatus(p?.status ?? 'not_started');
    } catch (err) {
      console.error('Failed to load lesson:', err);
    } finally {
      setLoading(false);
    }
  }, [courseId, lessonId]);

  useEffect(() => { load(); }, [load]);

  // The knowledge page is generated in the background after the course is
  // created, so poll briefly for it when the initial fetch missed it.
  useEffect(() => {
    if (loading || knowledgePage) return;
    let cancelled = false;
    waitForCourseDocument(courseId).then((page) => {
      if (!cancelled && page) setKnowledgePage(page);
    });
    return () => {
      cancelled = true;
    };
  }, [courseId, loading, knowledgePage]);

  // Auto-mark in-progress on first open
  useEffect(() => {
    if (!markedInProgress && progressStatus === 'not_started' && lesson) {
      setMarkedInProgress(true);
      updateLessonProgress(lessonId, courseId, 'in_progress').catch(console.error);
      setProgressStatus('in_progress');
    }
  }, [markedInProgress, progressStatus, lesson, lessonId, courseId]);

  const handleMarkComplete = useCallback(async () => {
    await updateLessonProgress(lessonId, courseId, 'completed');
    setProgressStatus('completed');
  }, [lessonId, courseId]);

  // ── Save to Page ──────────────────────────────────────────────────────────
  const handleSaveToPage = async () => {
    if (!knowledgePage || !selectedText.trim() || !lesson || !course) return;
    setSaving(true);
    setSaveError('');

    // Build source label: "Course → Lesson"
    const moduleName = modules
      .find((m) => m.lessons.some((l) => l.id === lessonId))?.title ?? '';
    const sourceLabel = moduleName
      ? `${course.title} → ${moduleName} → ${lesson.title}`
      : `${course.title} → ${lesson.title}`;

    const result = await saveToPage(
      knowledgePage.id,
      selectedText,
      saveSection,
      sourceLabel,
    );

    setSaving(false);

    if ('error' in result) {
      setSaveError(result.error);
    } else {
      setKnowledgePage(result);
      onPageUpdated?.(result);
      setSaveMsg(`Saved to "${saveSection}"`);
      setSelectedText('');
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  const allLessons   = modules.flatMap((m) => m.lessons);
  const currentIdx   = allLessons.findIndex((l) => l.id === lessonId);
  const nextLesson   = currentIdx >= 0 && currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;
  const prevLesson   = currentIdx > 0 ? allLessons[currentIdx - 1] : null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="w-8 h-8 text-warmgray-300 animate-spin mb-3" strokeWidth={1.5} />
        <p className="text-sm text-warmgray-400 font-serif">Loading lesson…</p>
      </div>
    );
  }

  if (!lesson || !course) {
    return (
      <div className="text-center py-20">
        <p className="font-serif text-xl text-ink-600">Lesson not found.</p>
        <button onClick={onBack} className="mt-4 text-sm text-terracotta-600 font-medium">
          Back to course
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Back link */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-warmgray-400 hover:text-ink-600 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
        {course.title}
      </button>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-xs text-warmgray-400 mb-3">
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
          {lesson.duration_minutes} min
        </span>
        {progressStatus === 'completed' && (
          <span className="flex items-center gap-1 text-sage-600 font-medium">
            <CheckCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
            Completed
          </span>
        )}
      </div>

      <h1 className="font-serif text-3xl md:text-4xl text-ink-700 leading-tight mb-2">{lesson.title}</h1>
      <p className="font-serif italic text-lg text-warmgray-400 mb-6">{lesson.subtitle}</p>

      {/* Learning objectives */}
      {lesson.learning_objectives.length > 0 && (
        <div className="bg-cream-100 rounded-xl2 border border-cream-200 p-5 mb-6">
          <p className="text-xs font-semibold text-terracotta-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" strokeWidth={1.5} />
            Learning Objectives
          </p>
          <ul className="space-y-1.5">
            {lesson.learning_objectives.map((obj, i) => (
              <li key={i} className="text-sm text-warmgray-500 flex items-start gap-2">
                <span className="text-terracotta-400 mt-0.5">·</span>
                {obj}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mode switcher */}
      <div className="flex flex-wrap gap-2 mb-6">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isActive = activeMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => setActiveMode(mode.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-ink-700 text-cream-50 shadow-soft'
                  : 'bg-cream-100 border border-cream-200 text-warmgray-500 hover:bg-cream-200'
              }`}
            >
              <Icon className="w-4 h-4" strokeWidth={1.5} />
              {mode.label}
            </button>
          );
        })}
      </div>

      {/* Lesson content area */}
      <div className="bg-cream-50 rounded-xl2 border border-cream-200 p-6 md:p-8 mb-8 min-h-[300px]">
        {activeMode === 'read' && (
          <div className="reading-text animate-fade-in" dangerouslySetInnerHTML={{ __html: lesson.content }} />
        )}
        {activeMode === 'summary' && (
          <div className="animate-fade-in">
            <div className="reading-text" dangerouslySetInnerHTML={{ __html: lesson.quick_summary }} />
            {lesson.key_takeaways.length > 0 && (
              <div className="mt-6 pt-5 border-t border-cream-200">
                <p className="text-xs font-semibold text-terracotta-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Key Takeaways
                </p>
                <ul className="space-y-2">
                  {lesson.key_takeaways.map((t, i) => (
                    <li key={i} className="text-sm text-warmgray-500 flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-sage-500 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {activeMode === 'eli10'     && <div className="reading-text animate-fade-in" dangerouslySetInnerHTML={{ __html: lesson.eli10     }} />}
        {activeMode === 'practice'  && <div className="reading-text animate-fade-in" dangerouslySetInnerHTML={{ __html: lesson.practice  }} />}
        {activeMode === 'flashcards'&& <FlashcardsMode lesson={lesson} courseId={courseId} />}
        {activeMode === 'quiz'      && <QuizMode lesson={lesson} courseId={courseId} onComplete={handleMarkComplete} />}
      </div>

      {/* ── Knowledge Page action bar ──────────────────────────────────────── */}
      {knowledgePage && (
        <div className="bg-cream-50 rounded-xl2 border border-cream-200 mb-8 overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3.5 flex items-center justify-between border-b border-cream-200">
            <div className="flex items-center gap-2 text-sm text-ink-600">
              <FileText className="w-4 h-4 text-warmgray-400" strokeWidth={1.5} />
              <span className="font-medium">{knowledgePage.title}</span>
              <span className="text-warmgray-400">— your knowledge page</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Save to Page toggle */}
              <button
                onClick={() => { setSavePanel((v) => !v); setSaveError(''); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  savePanel
                    ? 'bg-ink-700 text-cream-50'
                    : 'bg-cream-200 text-warmgray-600 hover:bg-cream-300 hover:text-ink-700'
                }`}
              >
                <BookMarked className="w-3.5 h-3.5" strokeWidth={1.5} />
                Save to page
              </button>

              {/* Open knowledge page */}
              {onOpenPage && (
                <button
                  onClick={() => onOpenPage(knowledgePage.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-warmgray-500 hover:text-ink-600 hover:bg-cream-200 transition-colors"
                  aria-label="Open knowledge page"
                >
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              )}
            </div>
          </div>

          {/* Save to Page panel */}
          {savePanel && (
            <div className="px-5 py-4 space-y-3 animate-fade-in">
              <textarea
                value={selectedText}
                onChange={(e) => setSelectedText(e.target.value)}
                placeholder="Paste or type content to save to your knowledge page…"
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl bg-cream-100 border border-cream-200 text-sm text-ink-600 placeholder:text-warmgray-300 focus:outline-none focus:border-sand-300 resize-none"
              />

              <div className="flex items-center gap-3 flex-wrap">
                {/* Section selector */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-warmgray-500">Add to:</label>
                  <select
                    value={saveSection}
                    onChange={(e) => setSaveSection(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-cream-100 border border-cream-200 text-xs text-ink-600 focus:outline-none focus:border-sand-300 cursor-pointer"
                  >
                    {PAGE_SECTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Save button */}
                <button
                  onClick={handleSaveToPage}
                  disabled={saving || !selectedText.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-terracotta-500 text-cream-50 hover:bg-terracotta-600 text-xs font-medium transition-colors disabled:opacity-50 ml-auto"
                >
                  {saving
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                    : <BookMarked className="w-3.5 h-3.5" strokeWidth={1.5} />}
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>

              {/* Feedback */}
              {saveMsg && (
                <p className="text-xs text-sage-700 flex items-center gap-1.5 animate-fade-in">
                  <Check className="w-3.5 h-3.5" strokeWidth={2} />
                  {saveMsg}
                </p>
              )}
              {saveError && (
                <p className="text-xs text-brick-500 flex items-center gap-1.5 animate-fade-in">
                  <X className="w-3.5 h-3.5" strokeWidth={2} />
                  {saveError}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Bottom actions ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-cream-200">
        {progressStatus !== 'completed' && (
          <button
            onClick={handleMarkComplete}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-terracotta-500 text-cream-50 hover:bg-terracotta-600 font-medium text-sm transition-colors shadow-soft"
          >
            <CheckCircle className="w-4 h-4" strokeWidth={1.5} />
            Mark as complete
          </button>
        )}
      </div>

      {/* Prev / Next navigation */}
      <div className="mt-8 pt-6 border-t border-cream-200 flex items-center justify-between gap-4">
        {prevLesson ? (
          <button
            onClick={() => onOpenLesson(courseId, prevLesson.id)}
            className="group flex items-center gap-2 text-left flex-1 max-w-xs"
          >
            <ArrowLeft className="w-5 h-5 text-warmgray-300 group-hover:text-terracotta-500 transition-colors flex-shrink-0" />
            <div>
              <p className="text-xs text-warmgray-400">Previous</p>
              <p className="text-sm font-medium text-ink-600 group-hover:text-terracotta-600 transition-colors">{prevLesson.title}</p>
            </div>
          </button>
        ) : <div className="flex-1 max-w-xs" />}

        {nextLesson ? (
          <button
            onClick={() => onOpenLesson(courseId, nextLesson.id)}
            className="group flex items-center gap-2 text-right flex-1 max-w-xs justify-end"
          >
            <div>
              <p className="text-xs text-warmgray-400">Next</p>
              <p className="text-sm font-medium text-ink-600 group-hover:text-terracotta-600 transition-colors">{nextLesson.title}</p>
            </div>
            <ArrowRight className="w-5 h-5 text-warmgray-300 group-hover:text-terracotta-500 transition-colors flex-shrink-0" />
          </button>
        ) : <div className="flex-1 max-w-xs" />}
      </div>
    </div>
  );
}

// ─── FlashcardsMode ───────────────────────────────────────────────────────────

function FlashcardsMode({ lesson, courseId }: { lesson: Lesson; courseId: string }) {
  const [index,    setIndex   ] = useState(0);
  const [isFlipped,setIsFlipped] = useState(false);
  const [reviewed, setReviewed ] = useState<Set<number>>(new Set());

  const card   = lesson.flashcards[index];
  const isLast = index === lesson.flashcards.length - 1;

  const handleReview = async (gotItRight: boolean) => {
    await recordFlashcardReview(courseId, lesson.id, index, gotItRight);
    setReviewed((prev) => new Set(prev).add(index));
    setTimeout(() => {
      setIsFlipped(false);
      setIndex(isLast ? 0 : (i) => i + 1);
    }, 250);
  };

  if (!card || lesson.flashcards.length === 0)
    return <p className="text-warmgray-400 text-sm">No flashcards for this lesson.</p>;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4 text-xs text-warmgray-400">
        <span>Card {index + 1} of {lesson.flashcards.length}</span>
        <span>{reviewed.size} reviewed</span>
      </div>
      <div className="flex items-center gap-2 mb-4">
        {lesson.flashcards.map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all ${
            i === index ? 'w-8 bg-terracotta-400' : reviewed.has(i) ? 'w-1.5 bg-sage-300' : 'w-1.5 bg-cream-300'
          }`} />
        ))}
      </div>
      <div className="perspective mb-5">
        <button
          onClick={() => setIsFlipped(!isFlipped)}
          className="relative w-full h-64 preserve-3d transition-transform duration-500 cursor-pointer"
          style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
          <div className="absolute inset-0 backface-hidden bg-cream-100 rounded-xl border border-cream-200 flex flex-col items-center justify-center p-6">
            <p className="text-xs font-semibold text-warmgray-400 uppercase tracking-wider mb-3">Question</p>
            <p className="font-serif text-lg text-ink-700 text-center leading-relaxed">{card.front}</p>
            <p className="absolute bottom-4 text-xs text-warmgray-300 flex items-center gap-1">
              <RotateCw className="w-3 h-3" strokeWidth={1.5} />Click to flip
            </p>
          </div>
          <div className="absolute inset-0 backface-hidden rotate-y-180 bg-terracotta-50 rounded-xl border border-terracotta-100 flex flex-col items-center justify-center p-6">
            <p className="text-xs font-semibold text-terracotta-400 uppercase tracking-wider mb-3">Answer</p>
            <p className="font-serif text-base text-ink-700 text-center leading-relaxed">{card.back}</p>
          </div>
        </button>
      </div>
      {isFlipped && (
        <div className="flex items-center justify-center gap-3 animate-fade-in">
          <button onClick={() => handleReview(false)} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brick-50 text-brick-500 border border-brick-100 hover:bg-brick-100 font-medium text-sm transition-colors">
            <X className="w-4 h-4" strokeWidth={2} />Need review
          </button>
          <button onClick={() => handleReview(true)} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-sage-100 text-sage-600 border border-sage-200 hover:bg-sage-200 font-medium text-sm transition-colors">
            <Check className="w-4 h-4" strokeWidth={2} />Got it
          </button>
        </div>
      )}
    </div>
  );
}

// ─── QuizMode ─────────────────────────────────────────────────────────────────

function QuizMode({ lesson, courseId, onComplete }: { lesson: Lesson; courseId: string; onComplete: () => void }) {
  const [currentIdx,  setCurrentIdx ] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [answers,     setAnswers    ] = useState<boolean[]>([]);
  const [showResult,  setShowResult ] = useState(false);
  const [finished,    setFinished   ] = useState(false);

  const questions = lesson.quiz;
  const question  = questions[currentIdx];
  const score     = answers.filter(Boolean).length;

  const handleSelect = (idx: number) => {
    if (selectedIdx !== null) return;
    setSelectedIdx(idx);
    setAnswers((prev) => [...prev, idx === question.correctIndex]);
    setShowResult(true);
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
      setSelectedIdx(null);
      setShowResult(false);
    } else {
      const finalScore = answers.filter(Boolean).length;
      saveQuizResult(courseId, lesson.id, finalScore, questions.length).catch(console.error);
      if (finalScore / questions.length >= 0.7) onComplete();
      setFinished(true);
    }
  };

  const handleRestart = () => {
    setCurrentIdx(0); setSelectedIdx(null);
    setAnswers([]); setShowResult(false); setFinished(false);
  };

  if (questions.length === 0)
    return <p className="text-warmgray-400 text-sm">No quiz for this lesson.</p>;

  if (finished) {
    const percent    = Math.round((score / questions.length) * 100);
    const isPassing  = percent >= 70;
    return (
      <div className="text-center py-6 animate-fade-in">
        <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${isPassing ? 'bg-sage-200' : 'bg-gold-100'}`}>
          <CheckCircle className={`w-8 h-8 ${isPassing ? 'text-sage-600' : 'text-gold-500'}`} strokeWidth={1.5} />
        </div>
        <h3 className="font-serif text-2xl text-ink-700 mb-1">{isPassing ? 'Well done!' : 'Keep studying'}</h3>
        <p className="text-sm text-warmgray-500 mb-4">
          You scored <span className="font-semibold text-ink-600">{score}</span> of{' '}
          <span className="font-semibold text-ink-600">{questions.length}</span> ({percent}%)
        </p>
        <button onClick={handleRestart} className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl bg-cream-100 border border-cream-200 text-ink-600 hover:bg-cream-200 font-medium text-sm transition-colors">
          <RotateCw className="w-4 h-4" strokeWidth={1.5} />Try again
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-1.5 mb-5">
        {questions.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${
            i < currentIdx ? (answers[i] ? 'bg-sage-300' : 'bg-brick-200')
              : i === currentIdx ? 'bg-terracotta-400' : 'bg-cream-300'
          }`} />
        ))}
      </div>
      <p className="text-xs text-warmgray-400 mb-3">Question {currentIdx + 1} of {questions.length}</p>
      <h3 className="font-serif text-xl text-ink-700 mb-5 leading-snug">{question.question}</h3>
      <div className="space-y-2.5">
        {question.options.map((option, idx) => {
          const isSelected  = selectedIdx === idx;
          const isCorrect   = idx === question.correctIndex;
          const showCorrect = showResult && isCorrect;
          const showWrong   = showResult && isSelected && !isCorrect;
          return (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              disabled={selectedIdx !== null}
              className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                showCorrect ? 'bg-sage-50 border-sage-300 text-sage-700'
                  : showWrong ? 'bg-brick-50 border-brick-200 text-brick-600'
                  : 'bg-cream-100 border-cream-200 hover:border-sand-200 hover:bg-cream-200'
              } ${selectedIdx !== null && !isSelected && !isCorrect ? 'opacity-50' : ''}`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                showCorrect ? 'bg-sage-400 text-cream-50' : showWrong ? 'bg-brick-300 text-cream-50' : 'bg-cream-200 text-warmgray-500'
              }`}>
                {showCorrect ? <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                  : showWrong ? <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                  : String.fromCharCode(65 + idx)}
              </div>
              <span className="text-sm text-ink-600 leading-relaxed">{option}</span>
            </button>
          );
        })}
      </div>
      {showResult && (
        <div className="mt-4 animate-fade-in">
          <div className={`p-4 rounded-xl ${answers[currentIdx] ? 'bg-sage-50 border border-sage-200' : 'bg-brick-50 border border-brick-100'}`}>
            <p className={`text-sm font-semibold mb-1 ${answers[currentIdx] ? 'text-sage-700' : 'text-brick-600'}`}>
              {answers[currentIdx] ? 'Correct!' : 'Not quite.'}
            </p>
            <p className="text-sm text-warmgray-500 leading-relaxed">{question.explanation}</p>
          </div>
          <button onClick={handleNext} className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-terracotta-500 text-cream-50 hover:bg-terracotta-600 font-medium text-sm transition-colors">
            {currentIdx < questions.length - 1 ? 'Next question' : 'See results'}
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
}
