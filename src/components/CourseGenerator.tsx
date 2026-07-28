import { useState, FormEvent } from 'react';
import { Sparkles, ArrowRight, Loader2, Target, Clock, BarChart3, BookOpen } from 'lucide-react';
import { generateCourse, type GenerationParams } from '@/lib/api';

interface CourseGeneratorProps {
  onGenerated: (courseId: string) => void;
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

export function CourseGenerator({ onGenerated, onCancel }: CourseGeneratorProps) {
  const [topic, setTopic] = useState('');
  const [knowledgeLevel, setKnowledgeLevel] = useState('Beginner');
  const [goal, setGoal] = useState('');
  const [timeCommitment, setTimeCommitment] = useState('30 min/day');
  const [difficulty, setDifficulty] = useState('Medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusText, setStatusText] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setError('');
    setLoading(true);
    setStatusText('Designing your curriculum...');

    const statusMessages = [
      'Designing your curriculum...',
      'Writing lessons...',
      'Creating flashcards...',
      'Building quizzes...',
      'Adding practice exercises...',
    ];
    let msgIdx = 0;
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % statusMessages.length;
      setStatusText(statusMessages[msgIdx]);
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
      setLoading(false);
      setStatusText('');
    } else {
      onGenerated(result.courseId);
    }
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center animate-fade-in">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full bg-terracotta-50 animate-gentle-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-terracotta-500 animate-spin" strokeWidth={1.5} />
          </div>
        </div>
        <h2 className="font-serif text-2xl text-ink-700 mb-2">Generating your course</h2>
        <p className="text-sm text-warmgray-400 font-serif italic">{statusText}</p>
        <p className="text-xs text-warmgray-300 mt-4">This usually takes 20-40 seconds</p>
      </div>
    );
  }

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

        <div>
          <label className="block text-sm font-semibold text-ink-600 mb-2">
            <Target className="w-4 h-4 inline mr-1.5 -mt-0.5" strokeWidth={1.5} />
            What's your goal? <span className="text-warmgray-300 font-normal">(optional)</span>
          </label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Deploy a Next.js application using Docker"
            rows={2}
            className="w-full px-4 py-3 rounded-xl bg-cream-100 border border-cream-200 text-sm text-ink-600 placeholder:text-warmgray-300 focus:outline-none focus:border-sand-300 focus:bg-cream-50 transition-colors resize-none"
          />
        </div>

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
                <option key={t} value={t}>
                  {t}
                </option>
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
