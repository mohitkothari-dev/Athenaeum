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
  Paperclip,
  Mic,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import type { AppDocument, CourseWithProgress, Source, SourceType } from '@/types';
import type { CanvasDocument } from '@/types/canvas';
import { COURSE_COLOR_GRADIENTS } from '@/lib/courseColors';
import { IngestionEngine, type IngestionInput } from '@/lib/ingestion';
import { generateNotesOrStudyGuide, retryIngestion } from '@/lib/api';
import { getYoutubeVideoId } from '@/lib/ingestion/providers/youtube';
import { supabase } from '@/lib/supabase';

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
  userId: string;
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
    includeKnowledgePage: boolean,
    sourceId?: string,
    isPracticeMode?: boolean
  ) => void;
  generatingCourse: boolean;
  generationError: string;
  onOpenDocument: (documentId: string) => void;
  onCreateDocument: (title: string) => Promise<void>;
  onOpenCanvas: (canvasId: string) => void;
  onCreateCanvas: () => Promise<void>;
  onDocumentCreated?: (doc: AppDocument) => void;
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
      className="group flex flex-col text-left w-full bg-cream-50 rounded-xl2 border border-cream-200 overflow-hidden hover:border-sand-200 hover:shadow-card transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-400 focus-visible:ring-offset-2"
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
  userId,
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
  onDocumentCreated,
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
  
  // Ingestion state variables
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedUrl, setAttachedUrl] = useState<string>('');
  const [attachedType, setAttachedType] = useState<SourceType | null>(null);
  
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  
  const [processingStage, setProcessingStage] = useState<'idle' | 'ingesting' | 'source_error' | 'source_ready' | 'generating'>('idle');
  const [ingestionStatus, setIngestionStatus] = useState<string>('pending');
  const [ingestionError, setIngestionError] = useState<string>('');
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [ingestedSource, setIngestedSource] = useState<Source | null>(null);
  const [ingestingElapsed, setIngestingElapsed] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  // Show intent picker once user starts typing or has attachment
  useEffect(() => {
    setShowIntentPicker(input.trim().length > 0 || attachedType !== null);
  }, [input, attachedType]);

  // Realtime subscription for source status transitions
  useEffect(() => {
    if (!activeSourceId || processingStage !== 'ingesting') return;
    const channel = supabase
      .channel(`source-status-${activeSourceId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sources',
          filter: `id=eq.${activeSourceId}`,
        },
        (payload) => {
          const updated = payload.new as Source;
          console.log('[Realtime] Source update received:', updated.status);
          setIngestionStatus(updated.status);
          if (updated.status === 'ready') {
            setIngestedSource(updated);
            setProcessingStage('source_ready');
          } else if (updated.status === 'error') {
            setIngestionError(updated.metadata?.error || 'Failed to process source material');
            setProcessingStage('source_error');
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeSourceId, processingStage]);

  // Polling fallback in case realtime lags or fails
  useEffect(() => {
    if (!activeSourceId || processingStage !== 'ingesting') return;

    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('sources')
          .select('*')
          .eq('id', activeSourceId)
          .single();

        if (!error && data) {
          const updated = data as Source;
          setIngestionStatus(updated.status);
          if (updated.status === 'ready') {
            setIngestedSource(updated);
            setProcessingStage('source_ready');
            clearInterval(interval);
          } else if (updated.status === 'error') {
            setIngestionError(updated.metadata?.error || 'Failed to process source material');
            setProcessingStage('source_error');
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.warn('Polling error:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeSourceId, processingStage]);

  // Elapsed timer + timeout for stuck ingesting (504/background tasks may silently fail)
  useEffect(() => {
    if (processingStage !== 'ingesting') {
      setIngestingElapsed(0);
      return;
    }    setIngestingElapsed(0);
    const tick = setInterval(() => setIngestingElapsed((e) => e + 1), 1000);
    return () => clearInterval(tick);
  }, [processingStage]);

  // If ingesting takes >90s without realtime/polling update, surface timeout but keep polling
  const INGEST_TIMEOUT_S = 90;
  const ingestingTimedOut = processingStage === 'ingesting' && ingestingElapsed >= INGEST_TIMEOUT_S;

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileAttachClick = (type: 'pdf' | 'audio') => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = type === 'pdf' ? '.pdf' : 'audio/*';
      setAttachedType(type);
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setAttachedUrl('');
    setShowLinkInput(false);
    setAttachedFile(file);
    
    if (!input.trim()) {
      setInput(`Learn from ${file.name.replace(/\.[^/.]+$/, '')}`);
    }
  };

  const handleAttachLinkSubmit = () => {
    if (!linkInput.trim()) return;
    
    setAttachedFile(null);
    setAttachedUrl(linkInput.trim());
    
    const isYouTube = getYoutubeVideoId(linkInput.trim()) !== null;
    setAttachedType(isYouTube ? 'youtube' : 'web');
    
    if (!input.trim()) {
      try {
        const urlObj = new URL(linkInput.trim());
        setInput(`Study content from ${urlObj.hostname}`);
      } catch {
        setInput('Study content from link');
      }
    }
    
    setShowLinkInput(false);
    setLinkInput('');
  };

  const handleRemoveAttachment = () => {
    setAttachedFile(null);
    setAttachedUrl('');
    setAttachedType(null);
  };

  const handleSubmit = async () => {
    if (!input.trim() || generatingCourse) return;

    if (attachedType) {
      setIngestionError('');
      setProcessingStage('ingesting');
      setIngestionStatus('pending');

      const ingestionInput: IngestionInput = {
        type: attachedType,
        file: attachedFile || undefined,
        url: attachedUrl || undefined,
      };

      try {
        const source = await IngestionEngine.ingest(ingestionInput, userId, (status) => {
          setIngestionStatus(status);
        });

        setActiveSourceId(source.id);
        
        if (source.status === 'ready') {
          setIngestedSource(source);
          setProcessingStage('source_ready');
        }
      } catch (err: unknown) {
        setIngestionError(err instanceof Error ? err.message : 'Ingestion failed');
        setProcessingStage('idle');
      }
    } else {
      const finalGoal = goal.trim() || 'Gain a solid understanding of the topic';
      onGenerateCourse(
        input.trim(),
        finalGoal,
        knowledgeLevel,
        timeCommitment,
        difficulty,
        intent === 'course+page'
      );
    }
  };

  const handleGenerateNotes = async (sourceId: string, type: 'notes' | 'study_guide') => {
    setProcessingStage('generating');
    try {
      const result = await generateNotesOrStudyGuide(sourceId, type);
      if (result && 'error' in result) {
        setIngestionError(result.error);
        setProcessingStage('source_ready');
      } else if (result) {
        if (onDocumentCreated) {
          onDocumentCreated(result as AppDocument);
        }
        onOpenDocument(result.id);
      }
    } catch (err: unknown) {
      setIngestionError(err instanceof Error ? err.message : 'Failed to generate');
      setProcessingStage('source_ready');
    }
  };

  // Shared "generate course from the ingested source" action. Used both from the
  // source-ready view and from the "Try again" button in the generating view's
  // error state, so a failed generation is always recoverable.
  const startGenerationFromSource = () => {
    if (!ingestedSource) return;
    setProcessingStage('generating');
    onGenerateCourse(
      input.trim() || ingestedSource.title,
      goal.trim() || 'Understand the source content thoroughly',
      knowledgeLevel,
      timeCommitment,
      difficulty,
      intent === 'course+page',
      ingestedSource.id
    );
  };

  const handleExampleClick = (example: string) => {
    setInput(example);
    textareaRef.current?.focus();
  };

  const recentCourses = dashboardProgress
    .filter((p) => p.completedLessons > 0 || p.totalLessons > 0)
    .sort((a, b) => {
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

  if (processingStage === 'ingesting') {
    return (
      <div className="max-w-lg mx-auto py-24 text-center animate-fade-in space-y-6">
        <div className="relative w-20 h-20 mx-auto">
          <div className="absolute inset-0 rounded-full bg-terracotta-50 animate-gentle-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-terracotta-500 animate-spin" strokeWidth={1.5} />
          </div>
        </div>
        <h2 className="font-serif text-2xl text-ink-700">Ingesting source material</h2>
        <p className="text-sm font-serif italic text-warmgray-400 capitalize">
          {ingestionStatus === 'uploading' && 'Uploading source to storage...'}
          {ingestionStatus === 'extracting' && 'Extracting text and contents...'}
          {ingestionStatus === 'understanding' && 'Analyzing and structuring source...'}
          {ingestionStatus !== 'uploading' && ingestionStatus !== 'extracting' && ingestionStatus !== 'understanding' && `${ingestionStatus}...`}
        </p>
        <p className="text-xs text-warmgray-300">
          This runs in the background. Please keep this page open. · {ingestingElapsed}s elapsed
        </p>
        {ingestingTimedOut && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left">
            <p className="text-sm font-medium text-amber-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Taking longer than expected
            </p>
            <p className="text-xs text-amber-700 mt-1">
              {attachedType === 'youtube'
                ? 'YouTube transcription can take 30–60s depending on video length.'
                : attachedType === 'audio'
                ? 'Audio transcription can take 20–40s depending on file size.'
                : attachedType === 'pdf'
                ? 'PDF extraction is running in the background — this usually completes in under 30s.'
                : 'Processing is taking longer than usual.'}
              {' '}If this persists, you can cancel and retry.
            </p>
          </div>
        )}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setProcessingStage('idle');
              setActiveSourceId(null);
              setIngestionError(ingestingTimedOut ? 'Ingestion timed out. Please retry — it now runs in background and avoids 504s.' : '');
            }}
            className="px-4 py-2 rounded-xl bg-cream-200 text-warmgray-600 hover:bg-cream-300 hover:text-ink-600 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          {ingestingTimedOut && (
            <button
              type="button"
              onClick={async () => {
                if (!activeSourceId) return;
                setIngestingElapsed(0);
                setIngestionError('');
                try {
                  await retryIngestion(activeSourceId);
                } catch (err) {
                  console.error('Retry invoke failed:', err);
                }
              }}
              className="px-4 py-2 rounded-xl bg-terracotta-500 text-cream-50 hover:bg-terracotta-600 text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (processingStage === 'source_error') {
    const errorMsg = ingestionError || 'Failed to process source material';
    return (
      <div className="max-w-lg mx-auto py-24 text-center animate-fade-in space-y-6">
        <div className="relative w-16 h-16 mx-auto">
          <div className="absolute inset-0 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-brick-500" strokeWidth={1.5} />
          </div>
        </div>
        <h2 className="font-serif text-2xl text-ink-700">Source extraction failed</h2>
        <div className="rounded-xl border border-brick-100 bg-brick-50 px-4 py-3 text-left">
          <p className="text-sm text-brick-700" role="alert">{errorMsg}</p>
        </div>
        <p className="text-xs text-warmgray-400">
          Try re-uploading the file, or check that it's not encrypted or corrupted.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={async () => {
              if (!activeSourceId) return;
              setIngestionError('');
              setIngestingElapsed(0);
              setProcessingStage('ingesting');
              setIngestionStatus('pending');
              try {
                await retryIngestion(activeSourceId);
              } catch (err) {
                const msg = err instanceof Error ? err.message : 'Retry failed';
                setIngestionError(msg);
                setProcessingStage('source_error');
              }
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-terracotta-500 text-cream-50 hover:bg-terracotta-600 font-medium text-sm transition-colors shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-400 focus-visible:ring-offset-2"
          >
            <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
            Retry extraction
          </button>
          <button
            type="button"
            onClick={() => {
              setProcessingStage('idle');
              setActiveSourceId(null);
              setIngestedSource(null);
              setAttachedFile(null);
              setAttachedUrl('');
              setAttachedType(null);
              setIngestionError('');
            }}
            className="px-5 py-2.5 rounded-xl bg-cream-200 text-warmgray-600 hover:bg-cream-300 hover:text-ink-600 font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warmgray-400"
          >
            Start over
          </button>
        </div>
      </div>
    );
  }

  if (processingStage === 'source_ready' && ingestedSource) {    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        {/* Source-ready card — same visual shell as the main input card */}
        <div className="rounded-2xl border border-cream-200 bg-cream-50 shadow-card overflow-hidden">

          {/* Source badge */}
          <div className="px-5 pt-4 pb-3 border-b border-cream-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" strokeWidth={2} />
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
              Source ready
            </span>
            <span className="text-xs text-warmgray-400 truncate max-w-xs" title={ingestedSource.title}>
              — {ingestedSource.title}
            </span>
          </div>

          {/* Editable topic / title */}
          <div className="px-5 pt-4">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  startGenerationFromSource();
                }
              }}
              placeholder={`Course title or topic for "${ingestedSource.title}"...`}
              rows={1}
              className="w-full resize-none bg-transparent text-lg font-serif text-ink-700 placeholder-warmgray-300 focus:outline-none leading-snug"
              style={{ minHeight: '2rem', maxHeight: '8rem' }}
            />
          </div>

          {/* Intent picker — same inline pill buttons */}
          <div className="px-5 py-3 space-y-3">
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
                    {!item.available && (
                      <span className="text-[10px] font-normal opacity-70 ml-0.5">Soon</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Personalize toggle — mirrors main flow */}
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
                </div>
              )}
            </div>
          </div>

          {/* Action bar */}
          <div className="px-4 py-3 border-t border-cream-200 flex items-center justify-between gap-3">
            <p className="text-xs text-warmgray-300">
              Press <kbd className="px-1 py-0.5 rounded bg-cream-200 text-warmgray-500 font-mono text-[11px]">Enter</kbd> to start
            </p>
            <button
              type="button"
              onClick={startGenerationFromSource}
              disabled={generatingCourse}
              aria-label="Generate course from ingested source"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-terracotta-500 text-cream-50 hover:bg-terracotta-600 font-medium text-sm transition-colors shadow-soft disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-400 focus-visible:ring-offset-2"
            >
              <Sparkles className="w-4 h-4" strokeWidth={1.5} />
              Generate
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Error */}
        {ingestionError && (
          <p className="text-sm text-brick-500 bg-brick-50 border border-brick-100 rounded-xl px-4 py-3 animate-fade-in flex items-center gap-2" role="alert">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{ingestionError}</span>
          </p>
        )}

        {/* Back link */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setProcessingStage('idle');
              setIngestedSource(null);
              setActiveSourceId(null);
              setAttachedFile(null);
              setAttachedUrl('');
              setAttachedType(null);
              setIngestionError('');
            }}
            className="text-xs text-warmgray-400 hover:text-terracotta-500 transition-colors"
          >
            Cancel and go back
          </button>
        </div>
      </div>
    );
  }

  if (processingStage === 'generating') {
    const genFailed = !!(generationError || ingestionError);
    return (
      <div className="max-w-lg mx-auto py-24 text-center animate-fade-in space-y-6">
        {genFailed ? (
          <>
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-brick-500" strokeWidth={1.5} />
              </div>
            </div>
            <h2 className="font-serif text-2xl text-ink-700">Generation didn't finish</h2>
            <p className="text-sm text-warmgray-400 font-serif italic" role="alert">
              {generationError || ingestionError}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={startGenerationFromSource}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-terracotta-500 text-cream-50 hover:bg-terracotta-600 font-medium text-sm transition-colors shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-400 focus-visible:ring-offset-2"
              >
                <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
                Try again
              </button>
              <button
                type="button"
                onClick={() => {
                  setIngestionError('');
                  setProcessingStage('source_ready');
                }}
                className="px-5 py-2.5 rounded-xl bg-cream-200 text-warmgray-600 hover:bg-cream-300 hover:text-ink-600 font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warmgray-400"
              >
                Cancel and go back
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full bg-terracotta-50 animate-gentle-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-terracotta-500 animate-spin" strokeWidth={1.5} />
              </div>
            </div>
            <h2 className="font-serif text-2xl text-ink-700">Creating your study resources</h2>
            <p className="text-sm text-warmgray-400 font-serif italic">
              Generating lessons, flashcards, and quizzes from grounding source...
            </p>
            <p className="text-xs text-warmgray-300">
              This will take 15–30 seconds.
            </p>
          </>
        )}
      </div>
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

          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Link Attachment Input */}
          {showLinkInput && (
            <div className="px-5 pb-3 flex gap-2 animate-fade-in">
              <input
                type="text"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="Paste YouTube or website article URL..."
                className="flex-1 px-3 py-1.5 rounded-lg bg-cream-100 border border-cream-200 text-xs text-ink-600 focus:outline-none focus:border-sand-350 transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAttachLinkSubmit();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAttachLinkSubmit}
                className="px-3 py-1.5 rounded-lg bg-terracotta-500 text-cream-50 text-xs font-semibold hover:bg-terracotta-600 transition-colors"
              >
                Attach
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLinkInput(false);
                  setLinkInput('');
                }}
                className="px-2 py-1.5 text-warmgray-400 hover:text-ink-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Attachment Badge */}
          {attachedType && (
            <div className="mx-5 mb-3 flex items-center justify-between bg-cream-200/50 rounded-lg p-2 border border-cream-200 animate-fade-in">
              <div className="flex items-center gap-2 min-w-0">
                {attachedType === 'pdf' && (
                  <span className="text-[10px] font-bold tracking-wider uppercase bg-red-100 text-red-700 px-1.5 py-0.5 rounded flex-shrink-0">
                    PDF File
                  </span>
                )}
                {attachedType === 'audio' && (
                  <span className="text-[10px] font-bold tracking-wider uppercase bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex-shrink-0">
                    Audio File
                  </span>
                )}
                {attachedType === 'youtube' && (
                  <span className="text-[10px] font-bold tracking-wider uppercase bg-red-100 text-red-700 px-1.5 py-0.5 rounded flex-shrink-0">
                    YouTube
                  </span>
                )}
                {attachedType === 'web' && (
                  <span className="text-[10px] font-bold tracking-wider uppercase bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded flex-shrink-0">
                    Web Link
                  </span>
                )}
                <span className="text-xs font-medium text-ink-600 truncate">
                  {attachedFile ? attachedFile.name : attachedUrl}
                </span>
              </div>
              <button
                type="button"
                onClick={handleRemoveAttachment}
                className="text-warmgray-400 hover:text-ink-600 p-0.5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Intent picker — revealed when input is non-empty */}
          {showIntentPicker && !attachedType && (
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
            {/* Attachment Tools */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleFileAttachClick('pdf')}
                title="Attach PDF Document"
                className="w-8.5 h-8.5 rounded-lg flex items-center justify-center text-warmgray-400 hover:text-ink-600 hover:bg-cream-200 transition-colors"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleFileAttachClick('audio')}
                title="Attach Audio File"
                className="w-8.5 h-8.5 rounded-lg flex items-center justify-center text-warmgray-400 hover:text-ink-600 hover:bg-cream-200 transition-colors"
              >
                <Mic className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowLinkInput(!showLinkInput)}
                title="Attach Web or YouTube Link"
                className="w-8.5 h-8.5 rounded-lg flex items-center justify-center text-warmgray-400 hover:text-ink-600 hover:bg-cream-200 transition-colors"
              >
                <LinkIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Hint or prompt suggestions */}
            {!showIntentPicker ? (
              <div className="hidden sm:flex flex-wrap gap-2 flex-1 justify-end" role="list" aria-label="Example topics">
                {EXAMPLE_PROMPTS.slice(0, 3).map((ex) => (
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
              <p className="text-xs text-warmgray-300 flex-1 text-right pr-2">
                Press <kbd className="px-1 py-0.5 rounded bg-cream-200 text-warmgray-500 font-mono text-[11px]">Enter</kbd> to start
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!input.trim() || generatingCourse}
              aria-label="Process and generate study resources"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-terracotta-500 text-cream-50 hover:bg-terracotta-600 font-medium text-sm transition-colors shadow-soft disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-400 focus-visible:ring-offset-2"
            >
              <Sparkles className="w-4 h-4" strokeWidth={1.5} />
              {attachedType ? 'Ingest Source' : 'Generate'}
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Error */}
        {(generationError || ingestionError) && (
          <p className="mt-3 text-sm text-brick-500 bg-brick-50 border border-brick-100 rounded-xl px-4 py-3 animate-fade-in flex items-center gap-2" role="alert">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{generationError || ingestionError}</span>
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
