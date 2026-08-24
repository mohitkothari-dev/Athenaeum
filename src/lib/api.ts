import { supabase } from '@/lib/supabase';
import type { Course, Module, Lesson, LessonProgress, QuizResult, FlashcardReview, AppDocument } from '@/types';
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
  await supabase.from('courses').delete().eq('id', courseId);
}

export interface GenerationParams {
  topic: string;
  knowledge_level: string;
  goal: string;
  time_commitment: string;
  difficulty: string;
  /** Whether to also generate a knowledge page for the course (default: true) */
  include_knowledge_page?: boolean;
}

export async function generateCourse(
  params: GenerationParams,
): Promise<{ courseId: string } | { error: string }> {
  // maxAttempts is only used for UNAUTHORIZED retries (session refresh + one retry).
  // Network errors and function errors (4xx/5xx) are NOT retried because the
  // function is non-idempotent — it may have already written the course to DB.
  const maxAttempts = 2;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Ensure we have a fresh session — stale/expired JWT causes gateway UNAUTHORIZED_NO_AUTH_HEADER
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      let token: string | null | undefined = sessionData.session?.access_token;
      if (sessionError) console.warn('getSession error before generateCourse:', sessionError);
      if (!token) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        token = refreshed.session?.access_token ?? null;
      }
      if (!token) {
        return { error: 'Session expired. Please refresh the page and sign in again.' };
      }

      // The edge function runs synchronously (Gemini call + DB writes) and
      // returns courseId on success. It is NOT safe to retry on network errors
      // because the function may have already completed and written the course.
      let rawData: unknown;
      let rawError: unknown;
      try {
        const { data, error } = await supabase.functions.invoke('generate-course', {
          body: params,
          headers: { Authorization: `Bearer ${token}` },
        });
        rawData = data;
        rawError = error;
      } catch (fetchError) {
        // Don't retry — the function may have already run and created a course row.
        // Surface the error so the user can try again manually.
        console.error('generateCourse network error (not retrying — function may have completed):', fetchError);
        return { error: 'Network error — please check your connection. If a course appeared in your library, it was generated successfully.' };
      }

      // Parse error responses from the edge function / Supabase gateway
      if (rawError) {
        const errObj = rawError as { message?: string; name?: string; context?: unknown };
        let status: number | undefined;
        let bodyObj: Record<string, unknown> | null = null;
        let bodyText: string | null = null;

        const ctx: unknown = errObj.context;
        if (ctx instanceof Response) {
          status = ctx.status;
          try {
            bodyObj = (await ctx.clone().json()) as Record<string, unknown>;
          } catch {
            try {
              bodyText = await ctx.clone().text();
              if (bodyText) {
                try { bodyObj = JSON.parse(bodyText) as Record<string, unknown>; } catch { /* keep as text */ }
              }
            } catch { /* ignore */ }
          }
        } else if (ctx && typeof ctx === 'object') {
          const maybe = ctx as { status?: number; body?: unknown };
          status = maybe.status;
          if (typeof maybe.body === 'string') {
            bodyText = maybe.body;
            try { bodyObj = JSON.parse(bodyText) as Record<string, unknown>; } catch { /* keep text */ }
          } else if (maybe.body && typeof maybe.body === 'object') {
            bodyObj = maybe.body as Record<string, unknown>;
          }
        }

        let bodyMsg = '';
        if (bodyObj) {
          const code = bodyObj.code as string | undefined;
          if (code === 'UNAUTHORIZED_NO_AUTH_HEADER' || code === 'UNAUTHORIZED') {
            console.error(`generateCourse attempt ${attempt + 1}: gateway UNAUTHORIZED`, bodyObj);
            // Auth errors are safe to retry (no course was created yet)
            if (attempt < maxAttempts - 1) {
              await supabase.auth.refreshSession();
              await new Promise((r) => setTimeout(r, 900 + Math.random() * 400));
              continue;
            }
            return { error: 'Authentication failed. Please refresh the page and sign in again.' };
          }
          const errStr = (bodyObj.error as string | undefined) ?? (bodyObj.message as string | undefined);
          if (errStr) bodyMsg = errStr;
          if (!bodyMsg && bodyText) bodyMsg = bodyText;
        } else if (bodyText) {
          bodyMsg = bodyText;
        } else {
          bodyMsg = errObj.message || '';
        }

        console.error(`generateCourse failed (attempt ${attempt + 1}):`, { status, bodyObj, bodyText });

        if (bodyMsg === 'Edge Function returned a non-2xx status code' || bodyMsg.toLowerCase().includes('edge function returned')) {
          bodyMsg = bodyObj ? JSON.stringify(bodyObj) : 'Generation failed — check function logs.';
        }

        const msg = bodyMsg || `Generation failed (status ${status ?? 'unknown'})`;

        // Only gateway-level errors (not function errors) are safe to retry.
        // 502 means the function ran and Gemini failed inside it — don't retry,
        // it would create orphan course rows and likely hit rate limits again.
        // 401 UNAUTHORIZED is already handled above.
        // 503/504 from the gateway (before the function runs) are safe to retry.
        const safeToRetry = (status === 503 || status === 504) && attempt < maxAttempts - 1;
        if (safeToRetry) {
          const backoff = 1200 * (attempt + 1) + Math.random() * 600;
          console.warn(`Retrying generateCourse (gateway error ${status}) in ${Math.round(backoff)}ms ...`);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        return { error: msg };
      }

      const resultData = rawData as { courseId?: string; error?: string } | null;
      if (!resultData?.courseId) {
        const msg = resultData?.error || 'Generation failed — no course ID returned';
        console.error(`generateCourse attempt ${attempt + 1}: missing courseId`, resultData);
        return { error: msg };
      }

      return { courseId: resultData.courseId };
    } catch (error) {
      console.error('generateCourse unexpected error:', error);
      // Don't retry — we can't know if the function already ran.
      return { error: 'Failed to connect to AI service. Please check your connection and try again.' };
    }
  }
  return { error: 'Failed to generate course. Please try again.' };
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
