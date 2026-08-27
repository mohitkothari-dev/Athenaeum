import { supabase } from '@/lib/supabase';

/**
 * AI Provider Configuration and Manager
 * 
 * Provides multi-provider AI service with automatic fallback and rate limiting.
 * Currently supports: Mistral, Gemini (in order of preference)
 */
import type { Course, Module, Lesson, LessonProgress, QuizResult, FlashcardReview, AppDocument, Source } from '@/types';
import type { CanvasDocument, CanvasElement } from '@/types/canvas';

function parseLesson(raw: Record<string, unknown>): Lesson {
  return {
    id: raw.id as string,
    course_id: raw.course_id as string,
    module_id: raw.module_id as string,
    title: raw.title as string,
    subtitle: raw.subtitle as string,
    learning_objectives: JSON.parse((raw.learning_objectives as string) || '[]'),
    content: raw.content as string,
    quick_summary: raw.quick_summary as string,
    eli10: raw.eli10 as string,
    key_takeaways: JSON.parse((raw.key_takeaways as string) || '[]'),
    practice: raw.practice as string,
    flashcards: JSON.parse((raw.flashcards as string) || '[]'),
    quiz: JSON.parse((raw.quiz as string) || '[]'),
    position: raw.position as number,
    duration_minutes: raw.duration_minutes as number,
    created_at: raw.created_at as string,
  };
}

export async function fetchCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Course[];
}

export async function fetchCourseWithModules(courseId: string): Promise<{
  course: Course;
  modules: Module[];
}> {
  const { data: courseData, error: courseError } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .maybeSingle();
  if (courseError || !courseData) throw courseError || new Error('Course not found');

  const { data: modulesData, error: modulesError } = await supabase
    .from('modules')
    .select('*')
    .eq('course_id', courseId)
    .order('position', { ascending: true });
  if (modulesError) throw modulesError;

  const { data: lessonsData, error: lessonsError } = await supabase
    .from('lessons')
    .select('*')
    .eq('course_id', courseId)
    .order('position', { ascending: true });
  if (lessonsError) throw lessonsError;

  const modules: Module[] = (modulesData || []).map((m: Record<string, unknown>) => ({
    id: m.id as string,
    course_id: m.course_id as string,
    title: m.title as string,
    description: m.description as string,
    position: m.position as number,
    lessons: (lessonsData || [])
      .filter((l: Record<string, unknown>) => l.module_id === m.id)
      .map(parseLesson),
  }));

  return { course: courseData as Course, modules };
}

export async function fetchLessonProgress(
  courseId: string,
): Promise<Map<string, LessonProgress>> {
  const { data, error } = await supabase
    .from('lesson_progress')
    .select('*')
    .eq('course_id', courseId);
  if (error) throw error;
  const map = new Map<string, LessonProgress>();
  (data || []).forEach((p: LessonProgress) => map.set(p.lesson_id, p));
  return map;
}

export interface CourseProgress {
  totalLessons: number;
  completedLessons: number;
  inProgressLessons: number;
  percent: number;
}

export async function fetchCourseProgress(courseId: string): Promise<CourseProgress> {
  const { count: total } = await supabase
    .from('lessons')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId);

  const progress = await fetchLessonProgress(courseId);
  const completedLessons = Array.from(progress.values()).filter((p) => p.status === 'completed').length;
  const inProgressLessons = Array.from(progress.values()).filter((p) => p.status === 'in_progress').length;
  const t = total ?? 0;
  return {
    totalLessons: t,
    completedLessons,
    inProgressLessons,
    percent: t > 0 ? Math.round((completedLessons / t) * 100) : 0,
  };
}

export async function updateLessonProgress(
  lessonId: string,
  courseId: string,
  status: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from('lesson_progress')
    .select('id')
    .eq('lesson_id', lessonId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('lesson_progress')
      .update({
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('lesson_id', lessonId);
  } else {
    await supabase.from('lesson_progress').insert({
      lesson_id: lessonId,
      course_id: courseId,
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    });
  }
}

export async function fetchQuizResults(courseId: string): Promise<QuizResult[]> {
  const { data, error } = await supabase
    .from('quiz_results')
    .select('*')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as QuizResult[];
}

export async function saveQuizResult(
  courseId: string,
  lessonId: string,
  score: number,
  total: number,
): Promise<void> {
  await supabase.from('quiz_results').insert({
    course_id: courseId,
    lesson_id: lessonId,
    score,
    total,
  });
}

export async function recordFlashcardReview(
  courseId: string,
  lessonId: string,
  flashcardIndex: number,
  gotItRight: boolean,
): Promise<void> {
  const { data: existing } = await supabase
    .from('flashcard_reviews')
    .select('*')
    .eq('lesson_id', lessonId)
    .eq('flashcard_index', flashcardIndex)
    .maybeSingle();

  if (existing) {
    const newLevel = Math.max(
      0,
      Math.min(3, (existing as FlashcardReview).mastery_level + (gotItRight ? 1 : -1)),
    );
    await supabase
      .from('flashcard_reviews')
      .update({
        mastery_level: newLevel,
        review_count: (existing as FlashcardReview).review_count + 1,
        last_reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', (existing as FlashcardReview).id);
  } else {
    await supabase.from('flashcard_reviews').insert({
      course_id: courseId,
      lesson_id: lessonId,
      flashcard_index: flashcardIndex,
      mastery_level: gotItRight ? 1 : 0,
      review_count: 1,
      last_reviewed_at: new Date().toISOString(),
    });
  }
}

export async function deleteCourse(courseId: string): Promise<void> {
  const { error } = await supabase.from('courses').delete().eq('id', courseId);
  if (error) throw error;
}

export async function updateCourse(
  id: string,
  updates: Partial<Pick<Course, 'title' | 'description'>>,
): Promise<Course> {
  if (updates.title !== undefined && !updates.title.trim()) {
    throw new Error('Course title cannot be empty.');
  }
  const { data, error } = await supabase
    .from('courses')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as Course;
}

export interface GenerationParams {
  topic: string;
  knowledge_level: string;
  goal: string;
  time_commitment: string;
  difficulty: string;
  /** Whether to also generate a knowledge page for the course (default: true) */
  include_knowledge_page?: boolean;
  source_id?: string; // Grounding source ID
  is_practice_mode?: boolean; // Practice-only course flag
}

// Configuration for AI providers - order matters (preferred first)
export const AI_PROVIDERS = [
  {
    name: 'Mistral',
    model: 'mistral-large-latest',
    apiKeyEnv: 'VITE_MISTRAL_API_KEY',
    enabled: !!import.meta.env.VITE_MISTRAL_API_KEY,
    priority: 1,
    rateLimit: { requests: 20, windowMs: 60000 }, // 20 requests per minute
    maxTokens: 6000,
    maxRetries: 2,
    apiUrl: 'https://api.mistral.ai/v1/chat/completions',
    endpoint: 'chat/completions'
  },
  {
    name: 'Groq',
    model: 'llama-3.1-70b-versatile',
    apiKeyEnv: 'VITE_GROQ_API_KEY',
    enabled: !!import.meta.env.VITE_GROQ_API_KEY,
    priority: 2,
    rateLimit: { requests: 100, windowMs: 60000 }, // 100 requests per minute (very generous)
    maxTokens: 8000,
    maxRetries: 3,
    apiUrl: 'https://api.groq.com/v1/chat/completions',
    endpoint: 'chat/completions'
  },
  {
    name: 'Gemini',
    model: 'gemini-3.6-flash',
    apiKeyEnv: 'VITE_GEMINI_API_KEY',
    enabled: !!import.meta.env.VITE_GEMINI_API_KEY,
    priority: 3,
    rateLimit: { requests: 10, windowMs: 60000 }, // 10 requests per minute (free tier)
    maxTokens: 6000,
    maxRetries: 2,
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/',
    endpoint: 'generateContent'
  }
];

export type AIProvider = typeof AI_PROVIDERS[0];

// Synthetic provider used when no VITE_ client API key is configured. It exists
// solely so a generation request still reaches the edge function, which owns
// provider selection and keys via server-side Supabase secrets
// (GEMINI_API_KEY / MISTRAL_API_KEY) — a client key is never required.
const SERVER_PROVIDER: AIProvider = {
  name: 'Server',
  model: '',
  apiKeyEnv: '',
  enabled: true,
  priority: Number.MAX_SAFE_INTEGER,
  rateLimit: { requests: Number.MAX_SAFE_INTEGER, windowMs: 60000 },
  maxTokens: 8000,
  maxRetries: 1,
  apiUrl: '',
  endpoint: '',
};

// Rate limiting and provider management
class AIProviderManager {
  private providerStats: Map<string, { requests: number; windowStart: number }> = new Map();
  private pendingRequests: Map<string, Promise<any>> = new Map();
  
  isProviderAvailable(provider: AIProvider): boolean {
    if (!provider.enabled) return false;
    
    const stats = this.providerStats.get(provider.name) || { requests: 0, windowStart: Date.now() - 60000 };
    const now = Date.now();
    
    // Reset window if expired
    if (now - stats.windowStart >= provider.rateLimit.windowMs) {
      stats.requests = 0;
      stats.windowStart = now;
    }
    
    return stats.requests < provider.rateLimit.requests;
  }
  
  async incrementProviderUsage(provider: AIProvider): Promise<void> {
    const stats = this.providerStats.get(provider.name) || { requests: 0, windowStart: Date.now() - 60000 };
    const now = Date.now();
    
    if (now - stats.windowStart >= provider.rateLimit.windowMs) {
      stats.requests = 0;
      stats.windowStart = now;
    }
    
    stats.requests++;
    this.providerStats.set(provider.name, stats);
    
    // Wait if rate limited
    if (stats.requests >= provider.rateLimit.requests) {
      const waitTime = provider.rateLimit.windowMs - (now - stats.windowStart);
      await new Promise(resolve => setTimeout(resolve, waitTime + 100));
      // Reset after waiting
      stats.requests = 0;
      stats.windowStart = Date.now();
      this.providerStats.set(provider.name, stats);
    }
  }
  
  async executeWithFallback(
    params: GenerationParams,
    preferredProviders?: string[]
  ): Promise<{ courseId: string } | { error: string }> {
    // Sort providers by preference and availability
    const availableProviders = AI_PROVIDERS
      .filter(provider => provider.enabled && this.isProviderAvailable(provider))
      .sort((a, b) => {
        // If preferredProviders specified, use that order
        if (preferredProviders) {
          const aIndex = preferredProviders.indexOf(a.name);
          const bIndex = preferredProviders.indexOf(b.name);
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
        }
        return a.priority - b.priority;
      });
    
    // The edge function performs AI generation server-side via Supabase secrets
    // (GEMINI_API_KEY / MISTRAL_API_KEY), so no VITE_ client key is required.
    // If no public provider key is configured, push the synthetic server pass so
    // the request still reaches the edge function instead of failing locally.
    if (availableProviders.length === 0) {
      availableProviders.push(SERVER_PROVIDER);
    }
    
    let lastError = '';
    let totalRetries = 0;
    
    for (const provider of availableProviders) {
      try {
        await this.incrementProviderUsage(provider);
        
        // Make the API call to the edge function with provider preference
        const { data, error } = await supabase.functions.invoke('generate-course', {
          body: {
            ...params,
            preferred_provider: provider.name.toLowerCase(),
            api_providers_config: AI_PROVIDERS.map(p => ({
              name: p.name,
              model: p.model,
              enabled: p.enabled
            }))
          },
          headers: { Authorization: `Bearer ${await this.getValidToken()}` },
        });
        
        if (error) {
          // Supabase wraps non-2xx in {message, context: Response}. Extract server body for useful diagnostics.
          const errObj = error as { message?: string; context?: unknown };
          const ctx: unknown = errObj.context;
          let serverMsg: string | null = null;
          let serverDetails: string | null = null;
          let status: number | undefined;
          if (ctx instanceof Response) {
            status = ctx.status;
            try {
              const body = await ctx.clone().json() as Record<string, unknown>;
              serverMsg = (body.error as string | undefined) ?? (body.message as string | undefined) ?? null;
              serverDetails = (body.details as string | undefined) ?? null;
            } catch {
              try { serverMsg = await ctx.clone().text(); } catch { /* ignore */ }
            }
          }
          const combined = [serverMsg, serverDetails].filter(Boolean).join(' — ') || errObj.message || String(error);
          // Surface status for transient gateway errors so UI can suggest retry
          const isTransient = status === 502 || status === 504 || status === 503 || combined.includes('502') || combined.includes('504');
          const msg = isTransient
            ? `${combined} (status ${status ?? 'gateway'} — transient, please retry in 10s)`
            : combined;
          throw new Error(msg);
        }
        
        if (data?.courseId) {
          console.log(`Course generation succeeded with ${provider.name}`);
          return { courseId: data.courseId };
        }
        
        // Edge may return {error, details} with 200? handle generically
        const dataObj = data as Record<string, unknown> | null;
        const dataErr = (dataObj?.error as string | undefined) ?? (dataObj?.message as string | undefined);
        const dataDetails = dataObj?.details as string | undefined;
        if (dataErr) throw new Error([dataErr, dataDetails].filter(Boolean).join(' — '));
        throw new Error('No course ID returned');
        
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        lastError = error;
        totalRetries++;
        
        console.error(`${provider.name} failed (attempt ${totalRetries}):`, error);
        
        // If this is the last provider, return the error (with one auto-retry for transient 502/503)
        if (provider === availableProviders[availableProviders.length - 1]) {
          const isTransient = error.includes('502') || error.includes('503') || error.includes('504') || error.toLowerCase().includes('gateway') || error.toLowerCase().includes('transient');
          if (isTransient && totalRetries < 3) {
            console.warn(`Transient 502/503 from ${provider.name}, auto-retrying in 4s (attempt ${totalRetries + 1}/3)...`);
            await new Promise((r) => setTimeout(r, 4000));
            try {
              await this.incrementProviderUsage(provider);
              const { data: retryData, error: retryErr } = await supabase.functions.invoke('generate-course', {
                body: {
                  ...params,
                  preferred_provider: provider.name.toLowerCase(),
                  api_providers_config: AI_PROVIDERS.map((p) => ({ name: p.name, model: p.model, enabled: p.enabled })),
                },
                headers: { Authorization: `Bearer ${await this.getValidToken()}` },
              });
              if (!retryErr && (retryData as Record<string, unknown>)?.courseId) {
                console.log(`Course generation succeeded on transient retry with ${provider.name}`);
                return { courseId: (retryData as { courseId: string }).courseId };
              }
              const retryMsg = retryErr
                ? ((retryErr as { message?: string }).message || String(retryErr))
                : ((retryData as Record<string, unknown>)?.error as string | undefined) || 'No course ID after retry';
              // Still failed — return friendly message that preserves Try again flow
              return { error: `${lastError} — auto-retry also failed: ${retryMsg}. Please click "Try again" in 10s.` };
            } catch (retryEx) {
              const rMsg = retryEx instanceof Error ? retryEx.message : String(retryEx);
              return { error: `${lastError} — auto-retry failed: ${rMsg}. Please click "Try again".` };
            }
          }
          // Enhanced error message with provider info
          const rateLimitMessages = {
            'Mistral': 'Mistral API rate limit reached. Try again in a few minutes.',
            'Gemini': 'Gemini API rate limit reached. The free tier has limited requests per minute.'
          };
          
          const rateLimitMsg = rateLimitMessages[provider.name as keyof typeof rateLimitMessages] || '';
          const enhancedError = rateLimitMsg || lastError;
          
          return { error: enhancedError };
        }
        
        // Small delay before trying next provider
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return { error: lastError || 'All AI providers failed' };
  }
  
  private async getValidToken(): Promise<string> {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) console.warn('getSession error:', sessionError);
    
    let token = sessionData.session?.access_token;
    if (!token) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      token = refreshed.session?.access_token;
    }
    
    if (!token) {
      throw new Error('Session expired. Please refresh the page and sign in again.');
    }
    
    return token;
  }
}

const aiProviderManager = new AIProviderManager();

export async function generateCourse(
  params: GenerationParams,
  preferredProviders?: string[]
): Promise<{ courseId: string } | { error: string }> {
  return aiProviderManager.executeWithFallback(params, preferredProviders);
}

/**
 * Fetch the knowledge page linked to a course, or null if none exists.
 * Used by CourseView to show the "Open Knowledge Page" button.
 */
export async function fetchDocumentByCourseId(
  courseId: string,
): Promise<AppDocument | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('course_id', courseId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('fetchDocumentByCourseId error:', error);
    return null;
  }
  return (data as AppDocument | null) ?? null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Poll for the knowledge page linked to a course until it exists.
 * The page is generated in the background by the edge function after the
 * course response returns, so it may land several seconds later.
 * Returns null if no document appears within the timeout.
 */
export async function waitForCourseDocument(
  courseId: string,
  { intervalMs = 2500, timeoutMs = 90000 } = {},
): Promise<AppDocument | null> {
  const deadline = Date.now() + timeoutMs;
  let doc = await fetchDocumentByCourseId(courseId);
  while (!doc && Date.now() < deadline) {
    await sleep(intervalMs);
    doc = await fetchDocumentByCourseId(courseId);
  }
  return doc;
}

// ─── generate-notes edge function client helpers ─────────────────────────────

/**
 * Appends user-selected text to a section of the linked knowledge page.
 * Uses supabase.functions.invoke so the gateway receives both `apikey` and
 * `Authorization` correctly when verify_jwt = true (best practice).
 * Returns the updated AppDocument or an error string.
 */
export async function saveToPage(
  documentId: string,
  selectedText: string,
  sectionHint: string,
  sourceLabel: string,
): Promise<AppDocument | { error: string }> {
  // Ensure fresh JWT — stale token triggers gateway UNAUTHORIZED_NO_AUTH_HEADER
  const { data: sessionData } = await supabase.auth.getSession();
  let token: string | null | undefined = sessionData.session?.access_token;
  if (!token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    token = refreshed.session?.access_token ?? null;
  }
  if (!token) return { error: 'Session expired. Please refresh the page and sign in again.' };

  try {
    const { data, error } = await supabase.functions.invoke('generate-notes', {
      body: { action: 'save_to_page', documentId, selectedText, sectionHint, sourceLabel },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (error) {
      const errObj = error as { message?: string; name?: string; context?: unknown };
      const ctx: unknown = errObj.context;
      let status: number | undefined;
      let bodyObj: Record<string, unknown> | null = null;
      let bodyText: string | null = null;
      if (ctx instanceof Response) {
        status = ctx.status;
        try { bodyObj = (await ctx.clone().json()) as Record<string, unknown>; } catch {
          try { bodyText = await ctx.clone().text(); if (bodyText) try { bodyObj = JSON.parse(bodyText) as Record<string, unknown>; } catch { /* keep text */ } } catch { /* ignore */ }
        }
      }
      if (bodyObj) {
        const code = bodyObj.code as string | undefined;
        if (code === 'UNAUTHORIZED_NO_AUTH_HEADER' || code === 'UNAUTHORIZED') {
          return { error: 'Authentication failed. Please refresh and sign in again.' };
        }
        const errStr = (bodyObj.error as string | undefined) ?? (bodyObj.message as string | undefined);
        if (errStr) return { error: errStr };
        if (bodyText) return { error: bodyText };
      }
      if (bodyText) return { error: bodyText };
      const msg = errObj.message || 'Failed to save to page';
      if (msg.includes('Edge Function returned a non-2xx')) {
        return { error: status ? `Save failed (status ${status}). Check function logs.` : 'Save failed — check function logs (supabase functions logs generate-notes).' };
      }
      return { error: msg };
    }

    const doc = (data as { document?: AppDocument } | null)?.document;
    if (!doc) return { error: 'Failed to save to page' };
    return doc;
  } catch {
    return { error: 'Failed to connect to server' };
  }
}

export async function fetchDocuments(): Promise<AppDocument[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as AppDocument[];
}

async function requireUserId(): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

export async function createDocument(
  title: string,
  parentId: string | null = null,
  courseId: string | null = null,
  lessonId: string | null = null,
  content: string = '',
): Promise<AppDocument> {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from('documents')
    .insert({
      title,
      parent_id: parentId,
      course_id: courseId,
      lesson_id: lessonId,
      user_id: userId,
      content,
      icon: '📝',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as AppDocument;
}

export async function updateDocument(
  id: string,
  updates: Partial<Omit<AppDocument, 'id' | 'user_id' | 'created_at'>>,
): Promise<AppDocument> {
  const { data, error } = await supabase
    .from('documents')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as AppDocument;
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ============================================
// Canvas API Functions
// ============================================

/**
 * Create a new canvas document
 * Validates: Requirements 1.1
 */
export async function createCanvas(title: string = 'Untitled Canvas'): Promise<CanvasDocument> {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from('canvas_documents')
    .insert({
      title,
      user_id: userId,
      icon: '🎨',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as CanvasDocument;
}

/**
 * Load all canvas documents for the authenticated user
 * Validates: Requirements 1.2
 */
export async function loadCanvases(): Promise<CanvasDocument[]> {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from('canvas_documents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as CanvasDocument[];
}

/** Load one canvas document. RLS guarantees it belongs to the signed-in user. */
export async function loadCanvasDocument(id: string): Promise<CanvasDocument> {
  const { data, error } = await supabase
    .from('canvas_documents')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as CanvasDocument;
}

/**
 * Update canvas document metadata (title, icon)
 * Validates: Requirements 1.4
 */
export async function updateCanvas(
  id: string,
  updates: Partial<Pick<CanvasDocument, 'title' | 'icon' | 'thumbnail'>>
): Promise<CanvasDocument> {
  if (updates.title !== undefined && (!updates.title.trim() || updates.title.length > 255)) {
    throw new Error('Canvas titles must be between 1 and 255 characters.');
  }
  const { data, error } = await supabase
    .from('canvas_documents')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as CanvasDocument;
}

/**
 * Delete canvas document and cascade delete all associated elements
 * Validates: Requirements 1.5
 */
export async function deleteCanvas(id: string): Promise<void> {
  const { error: elementsError } = await supabase
    .from('canvas_elements')
    .delete()
    .eq('canvas_id', id);
  if (elementsError) throw elementsError;

  const { error } = await supabase
    .from('canvas_documents')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/**
 * Save a canvas element (insert or update)
 * Validates: Requirements 12.1, 12.2
 */
export async function saveCanvasElement(element: CanvasElement): Promise<CanvasElement> {
  // Check if element exists
  const { data: existing } = await supabase
    .from('canvas_elements')
    .select('id')
    .eq('id', element.id)
    .maybeSingle();

  if (existing) {
    // Update existing element
    const { data, error } = await supabase
      .from('canvas_elements')
      .update({
        type: element.type,
        position: element.position,
        color: element.color,
        stroke_width: element.strokeWidth,
        type_specific_data: serializeElementData(element),
        updated_at: new Date().toISOString(),
      })
      .eq('id', element.id)
      .select('*')
      .single();

    if (error) throw error;
    return deserializeCanvasElement(data);
  } else {
    // Insert new element
    const { data, error } = await supabase
      .from('canvas_elements')
      .insert({
        id: element.id,
        canvas_id: element.canvas_id,
        type: element.type,
        position: element.position,
        color: element.color,
        stroke_width: element.strokeWidth,
        type_specific_data: serializeElementData(element),
      })
      .select('*')
      .single();

    if (error) throw error;
    return deserializeCanvasElement(data);
  }
}

/**
 * Load all canvas elements for a specific canvas
 * Validates: Requirements 12.3, 12.4
 */
export async function loadCanvasElements(canvasId: string): Promise<CanvasElement[]> {
  const { data, error } = await supabase
    .from('canvas_elements')
    .select('*')
    .eq('canvas_id', canvasId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(deserializeCanvasElement);
}

/**
 * Delete a canvas element
 * Validates: Requirements 12.4
 */
export async function deleteCanvasElement(id: string): Promise<void> {
  const { error } = await supabase
    .from('canvas_elements')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// Helper Functions for Canvas Element Serialization
// ============================================

/**
 * Serialize element-specific data to JSON for database storage
 */
function serializeElementData(element: CanvasElement): Record<string, unknown> {
  switch (element.type) {
    case 'stroke':
      return {
        points: element.points,
        tool: element.tool,
      };
    case 'rectangle':
      return {
        width: element.width,
        height: element.height,
        filled: element.filled,
      };
    case 'circle':
      return {
        radius: element.radius,
        filled: element.filled,
      };
    case 'triangle':
      return {
        width: element.width,
        height: element.height,
        filled: element.filled,
      };
    case 'arrow':
      return {
        endPoint: element.endPoint,
        headSize: element.headSize,
      };
    case 'line':
      return {
        endPoint: element.endPoint,
      };
    case 'text':
      return {
        content: element.content,
        fontSize: element.fontSize,
        fontFamily: element.fontFamily,
      };
    default:
      return {};
  }
}

/**
 * Deserialize canvas element from database record
 */
function deserializeCanvasElement(raw: Record<string, unknown>): CanvasElement {
  const base = {
    id: raw.id as string,
    canvas_id: raw.canvas_id as string,
    type: raw.type as CanvasElement['type'],
    position: raw.position as { x: number; y: number },
    color: raw.color as string,
    strokeWidth: raw.stroke_width as number,
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
  };
  const elementData = ((raw.type_specific_data || raw.element_data) as Record<string, unknown>) || {};

  switch (base.type) {
    case 'stroke':
      return {
        ...base,
        type: 'stroke',
        points: elementData.points as Array<{ x: number; y: number }>,
        tool: elementData.tool as 'pen' | 'pencil',
      };
    case 'rectangle':
      return {
        ...base,
        type: 'rectangle',
        width: elementData.width as number,
        height: elementData.height as number,
        filled: elementData.filled as boolean,
      };
    case 'circle':
      return {
        ...base,
        type: 'circle',
        radius: elementData.radius as number,
        filled: elementData.filled as boolean,
      };
    case 'triangle':
      return {
        ...base,
        type: 'triangle',
        width: elementData.width as number,
        height: elementData.height as number,
        filled: elementData.filled as boolean,
      };
    case 'arrow':
      return {
        ...base,
        type: 'arrow',
        endPoint: elementData.endPoint as { x: number; y: number },
        headSize: elementData.headSize as number,
      };
    case 'line':
      return {
        ...base,
        type: 'line',
        endPoint: elementData.endPoint as { x: number; y: number },
      };
    case 'text':
      return {
        ...base,
        type: 'text',
        content: elementData.content as string,
        fontSize: elementData.fontSize as number,
        fontFamily: elementData.fontFamily as string,
      };
    default:
      throw new Error(`Unknown element type: ${base.type}`);
  }
}

// ============================================
// Source Ingestion API Helpers
// ============================================

export async function fetchSources(): Promise<Source[]> {
  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Source[];
}

export async function fetchSource(sourceId: string): Promise<Source> {
  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .eq('id', sourceId)
    .single();
  if (error) throw error;
  return data as Source;
}

export async function deleteSource(source: Source): Promise<void> {
  if (source.storage_path) {
    const { error: storageError } = await supabase.storage
      .from('sources')
      .remove([source.storage_path]);
    if (storageError) {
      console.warn('Failed to delete storage file:', storageError);
    }
  }

  const { error } = await supabase
    .from('sources')
    .delete()
    .eq('id', source.id);
  if (error) throw error;
}

/**
 * Retry extraction for a source that previously failed.
 * Resets the source status to 'pending' and re-invokes the ingest-source
 * edge function. The caller should re-subscribe to Realtime to watch progress.
 */
export async function retryIngestion(sourceId: string): Promise<void> {
  const { error: resetError } = await supabase
    .from('sources')
    .update({ status: 'pending', metadata: {} })
    .eq('id', sourceId);
  if (resetError) throw new Error(`Failed to reset source status: ${resetError.message}`);

  const { data: sessionData } = await supabase.auth.getSession();
  let token: string | null | undefined = sessionData.session?.access_token;
  if (!token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    token = refreshed.session?.access_token ?? null;
  }
  if (!token) throw new Error('Session expired. Please refresh the page and sign in again.');

  const { error: invokeError } = await supabase.functions.invoke('ingest-source', {
    body: { sourceId },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (invokeError) {
    const msg = (invokeError as { message?: string }).message || String(invokeError);
    // 202 is expected (background processing) — SDK may surface it as an error
    if (!msg.includes('202')) {
      console.warn('retryIngestion invoke warning:', msg);
    }
  }
}

export async function generateNotesOrStudyGuide(
  sourceId: string,
  action: 'notes' | 'study_guide'
): Promise<AppDocument | { error: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  let token: string | null | undefined = sessionData.session?.access_token;
  if (!token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    token = refreshed.session?.access_token ?? null;
  }
  if (!token) return { error: 'Session expired. Please refresh the page and sign in again.' };

  try {
    const { data, error } = await supabase.functions.invoke('generate-notes', {
      body: {
        action: action === 'notes' ? 'generate_notes_from_source' : 'generate_study_guide_from_source',
        sourceId,
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (error) {
      console.error('Failed to generate notes/study guide:', error);
      return { error: (error as any).message || 'Failed to generate' };
    }

    const doc = (data as { document?: AppDocument } | null)?.document;
    if (!doc) return { error: 'No document returned' };
    return doc;
  } catch (err: any) {
    return { error: err.message || 'Failed to connect to server' };
  }
}

