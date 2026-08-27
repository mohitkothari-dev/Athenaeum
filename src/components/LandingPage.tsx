import { useEffect, useState } from 'react';
import {
  Sparkles,
  BookOpen,
  Layers,
  ListChecks,
  TrendingUp,
  ArrowRight,
  Clock,
  Target,
  Youtube,
  FileText,
  Mic,
  Globe,
  Wand2,
  GraduationCap,
  Play,
  AudioLines,
  FileStack,
  Brain,
  Zap,
  CheckCircle2,
} from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

const features = [
  {
    icon: BookOpen,
    title: 'Structured Lessons',
    description: 'AI generates a complete curriculum with modules, lessons, and clear learning objectives — not walls of text.',
  },
  {
    icon: Layers,
    title: 'Multiple Learning Modes',
    description: 'Every lesson supports Read, Quick Summary, Explain Like I\'m 10, Flashcards, Quiz, and Practice modes.',
  },
  {
    icon: ListChecks,
    title: 'Quizzes & Flashcards',
    description: 'Auto-generated quizzes test your understanding, while flashcards help you retain key concepts.',
  },
  {
    icon: TrendingUp,
    title: 'Progress Tracking',
    description: 'Track completed lessons, quiz scores, and course progress. Always know what to learn next.',
  },
];

const steps = [
  {
    icon: Target,
    title: 'Tell us your goal',
    description: 'Enter a topic, your current knowledge level, what you want to achieve, and how much time you have.',
  },
  {
    icon: Wand2,
    title: 'AI builds your course',
    description: 'Our multi-model AI understands your topic or ingested media and generates a personalized curriculum with lessons, flashcards, quizzes, and practice.',
  },
  {
    icon: GraduationCap,
    title: 'Start learning',
    description: 'Work through lessons at your own pace, switch between learning modes, and track your progress.',
  },
];

const mediaSources = [
  {
    icon: Youtube,
    label: 'YouTube videos',
    title: 'Any lecture, tutorial, documentary',
    description: 'Paste a link — we transcribe and understand chapters, concepts, and key moments to build a grounded course.',
    color: 'bg-red-50 border-red-200 text-red-500',
    accent: 'bg-red-500',
    example: 'youtube.com/watch?v=...',
  },
  {
    icon: FileText,
    label: 'PDF documents',
    title: 'Papers, textbooks, slide decks',
    description: 'Drop a PDF — research paper, textbook chapter, or slides. We extract text and structure into lessons.',
    color: 'bg-amber-50 border-amber-200 text-amber-600',
    accent: 'bg-amber-500',
    example: 'research-paper.pdf',
  },
  {
    icon: Mic,
    label: 'Audio files',
    title: 'Podcasts, lectures, voice memos',
    description: 'Upload audio — lectures, podcasts, interviews. We transcribe and turn spoken knowledge into a course.',
    color: 'bg-blue-50 border-blue-200 text-blue-500',
    accent: 'bg-blue-500',
    example: 'lecture-recording.mp3',
  },
];

/* Rotating demo words for hero pipeline */
const demoMediaCycle = [
  { icon: Youtube, label: 'YouTube link', text: 'Understanding Quantum Computing', sub: 'youtube.com • 42:18' },
  { icon: FileText, label: 'PDF document', text: 'Design Systems Handbook.pdf', sub: '124 pages • extracted in 8s' },
  { icon: AudioLines, label: 'Audio file', text: 'Naval — How to Get Rich podcast', sub: 'mp3 • 58 min transcribed' },
];

function MediaDemoCard() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % demoMediaCycle.length), 2600);
    return () => clearInterval(id);
  }, []);
  const current = demoMediaCycle[idx];
  const Icon = current.icon;
  return (
    <div className="relative bg-cream-50 rounded-xl2 border border-cream-200 shadow-lifted overflow-hidden">
      {/* top bar */}
      <div className="h-9 bg-cream-100 border-b border-cream-200 flex items-center gap-1.5 px-4">
        <span className="w-2.5 h-2.5 rounded-full bg-brick-300" />
        <span className="w-2.5 h-2.5 rounded-full bg-gold-200" />
        <span className="w-2.5 h-2.5 rounded-full bg-sage-300" />
        <span className="ml-auto text-[10px] font-semibold tracking-widest uppercase text-warmgray-300">Athenaeum Studio</span>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-bold tracking-widest uppercase text-terracotta-500">Input</span>
          <span className="h-px flex-1 bg-cream-200" />
          <span className="text-[10px] text-warmgray-300 flex items-center gap-1"><Zap className="w-3 h-3" /> multi-model</span>
        </div>
        {/* Animated media pill */}
        <div className="relative h-[64px] overflow-hidden rounded-xl bg-cream-100 border border-cream-200 p-3 flex items-center gap-3">
          <div
            key={idx}
            className="flex items-center gap-3 w-full animate-slide-up"
          >
            <div className="w-9 h-9 rounded-lg bg-terracotta-500 flex items-center justify-center flex-shrink-0 shadow-soft">
              <Icon className="w-5 h-5 text-cream-50" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-ink-700 truncate leading-none">{current.text}</p>
              <p className="text-[11px] text-warmgray-400 mt-1 truncate">{current.sub}</p>
            </div>
            <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center gap-1 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-gentle-pulse" />
              {current.label}
            </span>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center my-3">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-semibold tracking-widest uppercase text-warmgray-300">AI understands</span>
            <div className="w-px h-5 bg-gradient-to-b from-cream-200 to-terracotta-200" />
            <div className="w-6 h-6 rounded-full bg-terracotta-500 flex items-center justify-center shadow-soft animate-float">
              <Brain className="w-3.5 h-3.5 text-cream-50" strokeWidth={1.5} />
            </div>
            <div className="w-px h-5 bg-gradient-to-b from-terracotta-200 to-cream-200" />
          </div>
        </div>

        {/* Output preview */}
        <div className="rounded-xl border border-cream-200 bg-cream-100 p-3">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-bold tracking-widest uppercase text-sage-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Course ready
            </span>
            <span className="text-[10px] text-warmgray-400">6 modules • 18 lessons</span>
          </div>
          <div className="space-y-2">
            <div className="h-2 rounded-full bg-cream-200 overflow-hidden">
              <div className="h-full w-[78%] bg-gradient-to-r from-terracotta-400 to-terracotta-500 rounded-full" />
            </div>
            <div className="flex gap-1.5">
              <span className="text-[10px] px-2 py-1 rounded-full bg-cream-50 border border-cream-200 text-warmgray-500">Quizzes</span>
              <span className="text-[10px] px-2 py-1 rounded-full bg-cream-50 border border-cream-200 text-warmgray-500">Flashcards</span>
              <span className="text-[10px] px-2 py-1 rounded-full bg-terracotta-50 border border-terracotta-100 text-terracotta-600">Knowledge page</span>
            </div>
          </div>
        </div>
      </div>
      {/* subtle glow */}
      <div className="pointer-events-none absolute -right-10 -top-10 w-40 h-40 rounded-full bg-terracotta-200/20 blur-2xl" />
      <div className="pointer-events-none absolute -left-10 -bottom-10 w-32 h-32 rounded-full bg-sage-200/20 blur-2xl" />
    </div>
  );
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  return (
    <div className="min-h-screen overflow-hidden">
      {/* Decorative blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full bg-gradient-to-br from-terracotta-50 via-cream-100 to-sage-50 opacity-60 blur-3xl" />
        <div className="absolute top-[40%] -left-40 w-[480px] h-[480px] rounded-full bg-gradient-to-br from-gold-50 via-cream-100 to-terracotta-50 opacity-40 blur-3xl" />
      </div>

      <header className="px-6 md:px-10 lg:px-14 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-terracotta-500 flex items-center justify-center shadow-soft">
            <BookOpen className="w-5 h-5 text-cream-50" strokeWidth={1.5} />
          </div>
          <span className="font-serif text-xl text-ink-700 tracking-tight">Athenaeum</span>
        </div>
        <button
          onClick={onGetStarted}
          className="px-5 py-2 rounded-xl bg-ink-700 text-cream-50 hover:bg-ink-800 font-medium text-sm transition-colors"
        >
          Sign in
        </button>
      </header>

      {/* HERO */}
      <section className="px-6 md:px-10 lg:px-14 pt-10 md:pt-16 pb-14 max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cream-50 border border-cream-200 shadow-soft mb-6 animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-gentle-pulse" />
              <span className="text-xs font-medium text-ink-600">Multi-model intelligence</span>
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-warmgray-400">· YouTube · PDF · Audio · Web</span>
            </div>
            <h1
              className="font-serif text-5xl md:text-6xl lg:text-[4.2rem] text-ink-700 leading-[0.95] tracking-tight mb-5 animate-fade-in"
              style={{ animationDelay: '60ms', opacity: 0 }}
            >
              Learn anything
              <br />
              <span className="text-terracotta-500 italic">from anything.</span>
            </h1>
            <p
              className="reading-text !text-[1.05rem] !leading-[1.75] text-warmgray-500 max-w-xl mb-7 animate-fade-in"
              style={{ animationDelay: '120ms', opacity: 0 }}
            >
              Type a topic, paste a YouTube link, drop a PDF, or upload audio — Athenaeum turns it into a complete
              course with lessons, flashcards, quizzes, and practice. Grounded in your source, not hallucinated.
            </p>
            <div className="flex flex-wrap items-center gap-3 animate-fade-in" style={{ animationDelay: '180ms', opacity: 0 }}>
              <button
                onClick={onGetStarted}
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-terracotta-500 text-cream-50 hover:bg-terracotta-600 font-medium text-sm transition-all shadow-soft hover:shadow-lifted hover:gap-3"
              >
                Generate your first course
                <ArrowRight className="w-4 h-4" strokeWidth={2} />
              </button>
              <div className="flex items-center gap-2 text-sm text-warmgray-400">
                <Clock className="w-4 h-4" strokeWidth={1.5} />
                Ready in under a minute
              </div>
            </div>
            {/* source pills */}
            <div className="flex flex-wrap gap-2 mt-6 animate-fade-in" style={{ animationDelay: '240ms', opacity: 0 }}>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-100 text-xs font-medium text-red-600">
                <Youtube className="w-3.5 h-3.5" /> YouTube
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 text-xs font-medium text-amber-700">
                <FileText className="w-3.5 h-3.5" /> PDF
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-xs font-medium text-blue-600">
                <AudioLines className="w-3.5 h-3.5" /> Audio
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sage-50 border border-sage-200 text-xs font-medium text-sage-600">
                <Globe className="w-3.5 h-3.5" /> Web article
              </span>
            </div>
          </div>

          {/* Animated demo */}
          <div className="relative lg:pl-4 animate-fade-in" style={{ animationDelay: '200ms', opacity: 0 }}>
            <div className="absolute -inset-3 bg-gradient-to-br from-terracotta-100/50 via-cream-100 to-sage-100/40 rounded-[1.6rem] blur-xl -z-10" />
            <MediaDemoCard />
            {/* floating badges */}
            <div className="hidden md:flex absolute -left-6 top-8 items-center gap-2 px-3 py-2 rounded-xl bg-cream-50 border border-cream-200 shadow-card animate-float">
              <div className="w-7 h-7 rounded-lg bg-red-500 flex items-center justify-center">
                <Youtube className="w-4 h-4 text-white" strokeWidth={1.5} />
              </div>
              <span className="text-xs font-medium text-ink-600">YouTube → Course</span>
            </div>
            <div
              className="hidden md:flex absolute -right-4 bottom-10 items-center gap-2 px-3 py-2 rounded-xl bg-cream-50 border border-cream-200 shadow-card animate-float"
              style={{ animationDelay: '800ms' }}
            >
              <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
                <Mic className="w-4 h-4 text-white" strokeWidth={1.5} />
              </div>
              <span className="text-xs font-medium text-ink-600">Audio → Course</span>
            </div>
          </div>
        </div>
      </section>

      {/* MEDIA SOURCES */}
      <section className="px-6 md:px-10 lg:px-14 py-16 bg-cream-50 border-y border-cream-200">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-terracotta-50 border border-terracotta-100 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-terracotta-500" strokeWidth={1.5} />
              <span className="text-xs font-semibold tracking-widest uppercase text-terracotta-600">Learn from anything</span>
            </div>
            <h2 className="font-serif text-3xl md:text-4xl text-ink-700 mb-3">Your source is the syllabus</h2>
            <p className="text-warmgray-500 leading-relaxed">
              Don’t start from scratch. Bring the content you already love — Athenaeum ingests it, understands it, and
              structures it into a real curriculum you can actually complete.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {mediaSources.map((s, i) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="group relative bg-cream-100 rounded-xl2 border border-cream-200 p-6 hover:border-sand-200 hover:shadow-card transition-all animate-fade-in overflow-hidden"
                  style={{ animationDelay: `${i * 90}ms`, opacity: 0 }}
                >
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-4 ${s.color}`}>
                    <Icon className="w-6 h-6" strokeWidth={1.5} />
                  </div>
                  <div className="text-[11px] font-bold tracking-widest uppercase text-warmgray-400 mb-1.5">{s.label}</div>
                  <h3 className="font-serif text-lg text-ink-700 mb-2 leading-snug">{s.title}</h3>
                  <p className="text-sm text-warmgray-500 leading-relaxed mb-4">{s.description}</p>
                  <div className="flex items-center gap-2 text-xs font-mono text-warmgray-400 bg-cream-50 border border-cream-200 rounded-lg px-2.5 py-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.accent}`} />
                    <span className="truncate">{s.example}</span>
                  </div>
                  {/* hover accent */}
                  <div className="pointer-events-none absolute inset-0 rounded-xl2 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-white/40 to-transparent" />
                </div>
              );
            })}
          </div>

          {/* Pipeline */}
          <div className="mt-12 rounded-xl2 border border-cream-200 bg-cream-100 overflow-hidden">
            <div className="grid md:grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-4 p-6 md:p-8">
              <div className="text-center">
                <div className="w-14 h-14 rounded-xl bg-cream-50 border border-cream-200 flex items-center justify-center mx-auto mb-3 shadow-soft animate-float">
                  <FileStack className="w-6 h-6 text-warmgray-500" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-semibold text-ink-700">Drop any source</p>
                <p className="text-xs text-warmgray-400 mt-1">YouTube, PDF, audio, or plain topic</p>
              </div>
              <div className="hidden md:flex flex-col items-center">
                <ArrowRight className="w-5 h-5 text-terracotta-400" strokeWidth={1.5} />
                <span className="text-[10px] font-semibold tracking-widest uppercase text-terracotta-400 mt-1">Ingest</span>
              </div>
              <div className="text-center">
                <div className="relative w-14 h-14 rounded-xl bg-terracotta-500 flex items-center justify-center mx-auto mb-3 shadow-soft">
                  <Brain className="w-6 h-6 text-cream-50" strokeWidth={1.5} />
                  <span className="absolute -inset-1 rounded-xl border border-terracotta-200 animate-pulse-ring" aria-hidden="true" />
                  <span
                    className="absolute -inset-1 rounded-xl border border-terracotta-200 animate-pulse-ring"
                    style={{ animationDelay: '600ms' }}
                    aria-hidden="true"
                  />
                </div>
                <p className="text-sm font-semibold text-ink-700">AI understands</p>
                <p className="text-xs text-warmgray-400 mt-1">Transcribe · extract · structure</p>
              </div>
              <div className="hidden md:flex flex-col items-center">
                <ArrowRight className="w-5 h-5 text-terracotta-400" strokeWidth={1.5} />
                <span className="text-[10px] font-semibold tracking-widest uppercase text-terracotta-400 mt-1">Generate</span>
              </div>
              <div className="text-center">
                <div className="w-14 h-14 rounded-xl bg-sage-500 flex items-center justify-center mx-auto mb-3 shadow-soft animate-float" style={{ animationDelay: '400ms' }}>
                  <GraduationCap className="w-6 h-6 text-cream-50" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-semibold text-ink-700">Course ready</p>
                <p className="text-xs text-warmgray-400 mt-1">Lessons · quizzes · flashcards</p>
              </div>
            </div>
            <div className="px-6 pb-5 flex flex-wrap items-center justify-center gap-2 text-xs text-warmgray-400 border-t border-cream-200 bg-cream-50 py-3">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-sage-500" /> Grounded in your source
              </span>
              <span className="w-1 h-1 rounded-full bg-warmgray-200" />
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-sage-500" /> Background processing
              </span>
              <span className="w-1 h-1 rounded-full bg-warmgray-200" />
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-sage-500" /> Retry if needed
              </span>
            </div>
          </div>

          {/* Extra web hint */}
          <p className="text-center text-xs text-warmgray-400 mt-6 flex items-center justify-center gap-1.5">
            <Globe className="w-3.5 h-3.5" strokeWidth={1.5} />
            Also works with any web article — paste a URL and we extract the content for you.
          </p>
        </div>
      </section>

      {/* FEATURES */}
      <section className="px-6 md:px-10 lg:px-14 py-16 bg-cream-100">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-serif text-3xl text-ink-700 mb-3 text-center">Not another chatbot</h2>
          <p className="text-center text-warmgray-400 max-w-xl mx-auto mb-12">
            Chatbots answer questions. Athenaeum builds curricula. Here&apos;s what you get from a single prompt or source.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="bg-cream-50 rounded-xl2 border border-cream-200 p-6 animate-fade-in hover:shadow-card transition-shadow"
                  style={{ animationDelay: `${i * 80}ms`, opacity: 0 }}
                >
                  <div className="w-11 h-11 rounded-xl bg-terracotta-50 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-terracotta-500" strokeWidth={1.5} />
                  </div>
                  <h3 className="font-serif text-xl text-ink-700 mb-2">{feature.title}</h3>
                  <p className="text-sm text-warmgray-500 leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-6 md:px-10 lg:px-14 py-16 md:py-20 bg-cream-50 border-y border-cream-200">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-serif text-3xl text-ink-700 mb-3 text-center">How it works</h2>
          <p className="text-center text-warmgray-400 mb-12">Three steps from curiosity to curriculum — with or without media.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="text-center animate-fade-in" style={{ animationDelay: `${i * 100}ms`, opacity: 0 }}>
                  <div className="w-14 h-14 rounded-full bg-cream-100 border border-cream-200 flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-6 h-6 text-terracotta-500" strokeWidth={1.5} />
                  </div>
                  <div className="text-xs font-semibold text-terracotta-500 uppercase tracking-wider mb-2">Step {i + 1}</div>
                  <h3 className="font-serif text-lg text-ink-700 mb-2">{step.title}</h3>
                  <p className="text-sm text-warmgray-400 leading-relaxed">{step.description}</p>
                </div>
              );
            })}
          </div>

          {/* Media callout inside steps */}
          <div className="mt-10 rounded-xl border border-terracotta-100 bg-terracotta-50/50 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-terracotta-500 flex items-center justify-center flex-shrink-0">
              <Play className="w-4 h-4 text-cream-50" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-ink-600 leading-relaxed">
              <span className="font-semibold">Have a video, PDF, or audio?</span> Attach it during creation — ingestion runs in the background, then you choose to generate the course or just notes. No extra steps.
            </p>
          </div>
        </div>
      </section>

      {/* WHY GROUNDED */}
      <section className="px-6 md:px-10 lg:px-14 py-14">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h3 className="font-serif text-2xl text-ink-700 mb-3">Grounded, not guessed</h3>
            <p className="text-sm text-warmgray-500 leading-relaxed mb-4">
              Courses built from YouTube, PDFs, and audio aren’t hallucinations. Athenaeum transcribes and extracts your
              source text, then structures it into lessons with learning objectives, summaries, and practice — always
              traceable to what you provided.
            </p>
            <ul className="space-y-2 text-sm text-warmgray-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-sage-500 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                <span>Transcript-aware: lectures and podcasts are broken into concepts, not just summarized.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-sage-500 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                <span>PDF-aware: papers and decks keep their structure, figures, and key takeaways.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-sage-500 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                <span>Fallback-ready: if one AI provider is rate-limited, another picks up — no dead ends.</span>
              </li>
            </ul>
          </div>
          <div className="rounded-xl2 border border-cream-200 bg-cream-50 p-6 shadow-soft">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-ink-700 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-cream-50" strokeWidth={1.5} />
              </div>
              <span className="text-xs font-bold tracking-widest uppercase text-warmgray-400">Multi-model AI</span>
              <span className="ml-auto text-xs px-2 py-1 rounded-full bg-sage-50 border border-sage-200 text-sage-600 font-medium">Adaptive</span>
            </div>
            <p className="font-serif text-lg text-ink-700 mb-2">No single vendor lock-in.</p>
            <p className="text-sm text-warmgray-500 leading-relaxed mb-4">
              Athenaeum routes generation across multiple providers with automatic fallback. You get resilience and quality — not “Powered by one model.”
            </p>
            <div className="flex gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full bg-cream-100 border border-cream-200 text-warmgray-500">Mistral</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-cream-100 border border-cream-200 text-warmgray-500">Groq</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-cream-100 border border-cream-200 text-warmgray-500">Gemini</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-terracotta-50 border border-terracotta-100 text-terracotta-600">+ fallback</span>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 md:px-10 lg:px-14 py-20 md:py-28">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-serif text-4xl md:text-5xl text-ink-700 leading-tight mb-4">What do you want to learn?</h2>
          <p className="text-warmgray-500 mb-8 text-lg font-serif italic">
            From Docker to documentaries, from papers to podcasts — your next course is one source away.
          </p>
          <button
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-terracotta-500 text-cream-50 hover:bg-terracotta-600 font-medium text-sm transition-all shadow-soft hover:shadow-lifted hover:gap-3"
          >
            Start learning for free
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </section>

      <footer className="px-6 md:px-10 lg:px-14 py-8 border-t border-cream-200">
        <p className="text-center text-xs text-warmgray-300 font-serif italic">Athenaeum · Your AI learning companion</p>
      </footer>
    </div>
  );
}
