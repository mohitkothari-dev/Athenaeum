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

export async function fetchFlashcardReviews(
  courseId: string,
): Promise<Map<string, FlashcardReview>> {
  const { data, error } = await supabase
    .from('flashcard_reviews')
    .select('*')
    .eq('course_id', courseId);
  if (error) throw error;
  const map = new Map<string, FlashcardReview>();
  (data || []).forEach((r: FlashcardReview) =>
    map.set(`${r.lesson_id}-${r.flashcard_index}`, r),
  );
  return map;
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
}

export async function generateCourse(
  params: GenerationParams,
): Promise<{ courseId: string } | { error: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return { error: 'Not authenticated' };

    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-course`;
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    const result = await response.json();

    if (!response.ok) {
      return { error: result.error || 'Generation failed' };
    }

    return { courseId: result.courseId };
  } catch {
    return { error: 'Failed to connect to AI service' };
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

export async function createDocument(
  title: string,
  parentId: string | null = null,
  courseId: string | null = null,
  lessonId: string | null = null,
  content: string = '',
): Promise<AppDocument> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error('Not authenticated');

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
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error('Not authenticated');

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
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error('Not authenticated');

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
