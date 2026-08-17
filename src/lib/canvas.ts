import type { CanvasElement, CanvasTool, Point, StrokeElement, ViewportTransform } from '@/types/canvas';
import { renderElement } from '@/lib/renderers';

interface ElementBounds { x: number; y: number; width: number; height: number }
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

export const createCanvasId = (): string => crypto.randomUUID();
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
export const screenToWorld = (point: Point, viewport: ViewportTransform): Point => ({ x: (point.x - viewport.x) / viewport.scale, y: (point.y - viewport.y) / viewport.scale });
export const worldToScreen = (point: Point, viewport: ViewportTransform): Point => ({ x: point.x * viewport.scale + viewport.x, y: point.y * viewport.scale + viewport.y });

export function zoomAtPoint(viewport: ViewportTransform, point: Point, deltaY: number): ViewportTransform {
  const scale = clamp(viewport.scale * (deltaY > 0 ? 0.9 : 1.1), MIN_ZOOM, MAX_ZOOM);
  const world = screenToWorld(point, viewport);
  return { scale, x: point.x - world.x * scale, y: point.y - world.y * scale };
}

export function getElementBounds(element: CanvasElement): ElementBounds {
  const padding = Math.max(4, element.strokeWidth / 2);
  if (element.type === 'stroke') {
    const points = element.points.length ? element.points : [element.position];
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    const x = Math.min(...xs) - padding;
    const y = Math.min(...ys) - padding;
    return { x, y, width: Math.max(1, Math.max(...xs) - Math.min(...xs) + padding * 2), height: Math.max(1, Math.max(...ys) - Math.min(...ys) + padding * 2) };
  }
  if (element.type === 'circle') return { x: element.position.x - element.radius - padding, y: element.position.y - element.radius - padding, width: element.radius * 2 + padding * 2, height: element.radius * 2 + padding * 2 };
  if (element.type === 'rectangle' || element.type === 'triangle') return { x: element.position.x - padding, y: element.position.y - padding, width: element.width + padding * 2, height: element.height + padding * 2 };
  if (element.type === 'arrow' || element.type === 'line') {
    const x = Math.min(element.position.x, element.endPoint.x) - padding;
    const y = Math.min(element.position.y, element.endPoint.y) - padding;
    return { x, y, width: Math.abs(element.endPoint.x - element.position.x) + padding * 2, height: Math.abs(element.endPoint.y - element.position.y) + padding * 2 };
  }
  // Text dimensions calculation with multiline support
  const lines = element.content.split('\n');
  const maxLineLength = Math.max(1, ...lines.map(l => l.length));
  const textWidth = Math.max(20, maxLineLength * element.fontSize * 0.58);
  const textHeight = Math.max(element.fontSize, lines.length * element.fontSize * 1.3);
  return { x: element.position.x - padding, y: element.position.y - padding, width: textWidth + padding * 2, height: textHeight + padding * 2 };
}

function intersectsBounds(first: ElementBounds, second: ElementBounds): boolean {
  return first.x <= second.x + second.width && first.x + first.width >= second.x && first.y <= second.y + second.height && first.y + first.height >= second.y;
}

export function moveElement(element: CanvasElement, deltaX: number, deltaY: number): CanvasElement {
  const updated_at = new Date().toISOString();
  if (element.type === 'stroke') {
    return {
      ...element,
      position: { x: element.position.x + deltaX, y: element.position.y + deltaY },
      points: element.points.map(p => ({ x: p.x + deltaX, y: p.y + deltaY })),
      updated_at,
    };
  }
  if (element.type === 'arrow' || element.type === 'line') {
    return {
      ...element,
      position: { x: element.position.x + deltaX, y: element.position.y + deltaY },
      endPoint: { x: element.endPoint.x + deltaX, y: element.endPoint.y + deltaY },
      updated_at,
    };
  }
  return {
    ...element,
    position: { x: element.position.x + deltaX, y: element.position.y + deltaY },
    updated_at,
  };
}

export function getElementsInRect(
  rect: { x: number; y: number; width: number; height: number },
  elements: CanvasElement[]
): CanvasElement[] {
  const normalizedRect = {
    x: Math.min(rect.x, rect.x + rect.width),
    y: Math.min(rect.y, rect.y + rect.height),
    width: Math.abs(rect.width),
    height: Math.abs(rect.height),
  };
  return elements.filter(element => {
    const bounds = getElementBounds(element);
    return intersectsBounds(bounds, normalizedRect);
  });
}

export function pointHitsElement(point: Point, element: CanvasElement, tolerance = 6): boolean {
  const bounds = getElementBounds(element);
  return intersectsBounds(bounds, { x: point.x - tolerance, y: point.y - tolerance, width: tolerance * 2, height: tolerance * 2 });
}

export function isElementVisible(element: CanvasElement, viewport: ViewportTransform, size: { width: number; height: number }): boolean {
  const bounds = getElementBounds(element);
  const topLeft = worldToScreen({ x: bounds.x, y: bounds.y }, viewport);
  const bottomRight = worldToScreen({ x: bounds.x + bounds.width, y: bounds.y + bounds.height }, viewport);
  const padding = 100;
  return !(topLeft.x > size.width + padding || bottomRight.x < -padding || topLeft.y > size.height + padding || bottomRight.y < -padding);
}

export function validateCanvasElement(element: CanvasElement): string | null {
  const validPoint = (point: Point) => Number.isFinite(point.x) && Number.isFinite(point.y);
  if (!element.id || !element.canvas_id || !validPoint(element.position)) return 'Element id, canvas id, and finite position are required.';
  if (!/^#[0-9a-fA-F]{6}$/.test(element.color)) return 'Canvas color must be a six-digit hex value.';
  if (!Number.isFinite(element.strokeWidth) || element.strokeWidth < 1 || element.strokeWidth > 20) return 'Stroke width must be between 1 and 20.';
  if (element.type === 'stroke' && (element.points.length < 2 || !element.points.every(validPoint))) return 'Strokes need at least two finite points.';
  if ((element.type === 'rectangle' || element.type === 'triangle') && (!(element.width > 0) || !(element.height > 0))) return 'Shape dimensions must be positive.';
  if (element.type === 'circle' && !(element.radius > 0)) return 'Circle radius must be positive.';
  if ((element.type === 'arrow' || element.type === 'line') && !validPoint(element.endPoint)) return 'Line endpoint must be finite.';
  if (element.type === 'text' && (!element.content.trim() || element.fontSize < 8 || element.fontSize > 72)) return 'Text must be non-empty and 8–72px.';
  return null;
}

export function createStrokeElement(points: Point[], tool: 'pen' | 'pencil', canvasId: string, color: string, strokeWidth: number): StrokeElement {
  const now = new Date().toISOString();
  return {
    id: createCanvasId(),
    canvas_id: canvasId,
    type: 'stroke',
    position: points[0],
    points,
    tool,
    color,
    strokeWidth,
    created_at: now,
    updated_at: now,
  };
}

export function createShapeElement(tool: Extract<CanvasTool, 'rectangle' | 'circle' | 'triangle' | 'arrow' | 'line'>, canvasId: string, start: Point, end: Point, color: string, strokeWidth: number): CanvasElement | null {
  const now = new Date().toISOString();
  const base = { id: createCanvasId(), canvas_id: canvasId, color, strokeWidth, created_at: now, updated_at: now };
  if (tool === 'circle') {
    const radius = Math.hypot(end.x - start.x, end.y - start.y);
    return radius > 0 ? { ...base, type: 'circle', position: start, radius, filled: false } : null;
  }
  if (tool === 'arrow' || tool === 'line') return Math.hypot(end.x - start.x, end.y - start.y) > 0 ? { ...base, type: tool, position: start, endPoint: end, ...(tool === 'arrow' ? { headSize: Math.max(8, strokeWidth * 4) } : {}) } as CanvasElement : null;
  const position = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) };
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return width > 0 && height > 0 ? { ...base, type: tool, position, width, height, filled: false } : null;
}

export function generateThumbnail(elements: CanvasElement[]): string | null {
  if (!elements.length || typeof document === 'undefined') return null;
  const all = elements.map(getElementBounds);
  const left = Math.min(...all.map(bounds => bounds.x));
  const top = Math.min(...all.map(bounds => bounds.y));
  const right = Math.max(...all.map(bounds => bounds.x + bounds.width));
  const bottom = Math.max(...all.map(bounds => bounds.y + bounds.height));
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 200;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#faf8f2';
  context.fillRect(0, 0, 200, 200);
  const scale = Math.min(180 / width, 180 / height);
  context.translate(100 - ((left + width / 2) * scale), 100 - ((top + height / 2) * scale));
  context.scale(scale, scale);
  elements.forEach(element => renderElement(context, element));
  return canvas.toDataURL('image/png');
}
