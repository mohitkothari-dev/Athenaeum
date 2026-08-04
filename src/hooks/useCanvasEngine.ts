import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CanvasElement, Point, ViewportTransform } from '@/types/canvas';
import { isElementVisible, screenToWorld, worldToScreen, zoomAtPoint } from '@/lib/canvas';
import { renderElement } from '@/lib/renderers';

interface UseCanvasEngineProps {
  elements: CanvasElement[];
  onRenderOverlay?: (context: CanvasRenderingContext2D, viewport: ViewportTransform) => void;
  /** When false, skip canvas sizing/rendering until the canvas element is mounted. */
  enabled?: boolean;
}

export interface CanvasEngine {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  viewport: ViewportTransform;
  setViewport: React.Dispatch<React.SetStateAction<ViewportTransform>>;
  screenToCanvas: (clientX: number, clientY: number) => Point | null;
  canvasToScreen: (point: Point) => Point;
  panBy: (deltaX: number, deltaY: number) => void;
  zoom: (deltaY: number, clientX: number, clientY: number) => void;
  renderCanvas: () => void;
}

export function useCanvasEngine({ elements, onRenderOverlay, enabled = true }: UseCanvasEngineProps): CanvasEngine {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewport, setViewport] = useState<ViewportTransform>({ x: 0, y: 0, scale: 1 });
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const [size, setSize] = useState({ width: 0, height: 0, dpr: 1 });
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const screenToCanvas = useCallback((clientX: number, clientY: number): Point | null => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return screenToWorld({ x: clientX - rect.left, y: clientY - rect.top }, viewportRef.current);
  }, []);

  const canvasToScreen = useCallback((point: Point): Point => worldToScreen(point, viewportRef.current), []);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const currentSize = sizeRef.current;
    const currentViewport = viewportRef.current;
    if (!canvas || !currentSize.width || !currentSize.height) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(currentSize.dpr, 0, 0, currentSize.dpr, 0, 0);
    context.clearRect(0, 0, currentSize.width, currentSize.height);
    context.save();
    context.translate(currentViewport.x, currentViewport.y);
    context.scale(currentViewport.scale, currentViewport.scale);
    elements.filter(element => isElementVisible(element, currentViewport, currentSize)).forEach(element => renderElement(context, element));
    context.restore();
    onRenderOverlay?.(context, currentViewport);
  }, [elements, onRenderOverlay]);

  const renderCanvasRef = useRef(renderCanvas);
  renderCanvasRef.current = renderCanvas;

  useLayoutEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = rect.width;
      const height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      const nextSize = { width, height, dpr };
      sizeRef.current = nextSize;
      setSize(prev => (prev.width === width && prev.height === height && prev.dpr === dpr ? prev : nextSize));
      requestAnimationFrame(() => renderCanvasRef.current());
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(canvas);
    const handleContextRestored = () => requestAnimationFrame(() => renderCanvasRef.current());
    const handleContextLost = (event: Event) => event.preventDefault();
    canvas.addEventListener('contextlost', handleContextLost);
    canvas.addEventListener('contextrestored', handleContextRestored);
    return () => {
      observer.disconnect();
      canvas.removeEventListener('contextlost', handleContextLost);
      canvas.removeEventListener('contextrestored', handleContextRestored);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    renderCanvas();
  }, [enabled, renderCanvas, viewport]);

  const panBy = useCallback((deltaX: number, deltaY: number) => {
    setViewport(current => ({ ...current, x: current.x + deltaX, y: current.y + deltaY }));
  }, []);

  const zoom = useCallback((deltaY: number, clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const point = { x: clientX - rect.left, y: clientY - rect.top };
    setViewport(current => zoomAtPoint(current, point, deltaY));
  }, []);

  return { canvasRef, viewport, setViewport, screenToCanvas, canvasToScreen, panBy, zoom, renderCanvas };
}
