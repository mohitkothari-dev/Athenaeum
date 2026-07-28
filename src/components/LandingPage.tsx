import { Sparkles, BookOpen, Layers, ListChecks, PenLine, TrendingUp, ArrowRight, Clock, Target, Lightbulb } from 'lucide-react';

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
    icon: Lightbulb,
    title: 'AI builds your course',
    description: 'Gemini AI generates a personalized curriculum with lessons, flashcards, quizzes, and practice exercises.',
  },
  {
    icon: ArrowRight,
    title: 'Start learning',
    description: 'Work through lessons at your own pace, switch between learning modes, and track your progress.',
  },
];

export function LandingPage({ onGetStarted }: LandingPageProps) {
  return (
    <div className="min-h-screen">
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

      <section className="px-6 md:px-10 lg:px-14 pt-16 md:pt-24 pb-20 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-terracotta-50 border border-terracotta-100 mb-6 animate-fade-in">
          <Sparkles className="w-3.5 h-3.5 text-terracotta-500" strokeWidth={1.5} />
          <span className="text-xs font-medium text-terracotta-600">Powered by Gemini AI</span>
        </div>
        <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl text-ink-700 leading-[1.1] tracking-tight mb-6 animate-fade-in" style={{ animationDelay: '60ms', opacity: 0 }}>
          Learn anything.
          <br />
          <span className="text-terracotta-500 italic">On your terms.</span>
        </h1>
        <p className="reading-text !text-[1.125rem] !leading-[1.75] text-warmgray-500 max-w-2xl mb-8 animate-fade-in" style={{ animationDelay: '120ms', opacity: 0 }}>
          Type a topic, and AI generates a complete course for you — lessons, flashcards, quizzes,
          and practice exercises. Not a chatbot that talks at you, but a learning companion that
          structures your journey from beginner to confident.
        </p>
        <div className="flex flex-wrap items-center gap-4 animate-fade-in" style={{ animationDelay: '180ms', opacity: 0 }}>
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
      </section>

      <section className="px-6 md:px-10 lg:px-14 py-16 bg-cream-50 border-y border-cream-200">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-serif text-3xl text-ink-700 mb-3 text-center">Not another chatbot</h2>
          <p className="text-center text-warmgray-400 max-w-xl mx-auto mb-12">
            Chatbots answer questions. Athenaeum builds curricula. Here's what you get from a single prompt.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="bg-cream-100 rounded-xl2 border border-cream-200 p-6 animate-fade-in"
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

      <section className="px-6 md:px-10 lg:px-14 py-16 md:py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-serif text-3xl text-ink-700 mb-3 text-center">How it works</h2>
          <p className="text-center text-warmgray-400 mb-12">Three steps from curiosity to curriculum.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="text-center animate-fade-in" style={{ animationDelay: `${i * 100}ms`, opacity: 0 }}>
                  <div className="w-14 h-14 rounded-full bg-cream-100 border border-cream-200 flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-6 h-6 text-terracotta-500" strokeWidth={1.5} />
                  </div>
                  <div className="text-xs font-semibold text-terracotta-500 uppercase tracking-wider mb-2">
                    Step {i + 1}
                  </div>
                  <h3 className="font-serif text-lg text-ink-700 mb-2">{step.title}</h3>
                  <p className="text-sm text-warmgray-400 leading-relaxed">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-6 md:px-10 lg:px-14 py-20 md:py-28">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-serif text-4xl md:text-5xl text-ink-700 leading-tight mb-4">
            What do you want to learn?
          </h2>
          <p className="text-warmgray-500 mb-8 text-lg font-serif italic">
            From Docker to Descartes, from photography to Python — your next course is one prompt away.
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
        <p className="text-center text-xs text-warmgray-300 font-serif italic">
          Athenaeum · Your AI learning companion
        </p>
      </footer>
    </div>
  );
}
