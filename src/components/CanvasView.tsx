import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Loader2, RotateCcw } from 'lucide-react';
import type { CanvasDocument, CanvasElement, CanvasTool, Point, ViewportTransform } from '@/types/canvas';
import { createCanvasId, createShapeElement, generateThumbnail, getElementBounds, pointHitsElement, validateCanvasElement, worldToScreen } from '@/lib/canvas';
import { deleteCanvasElement, loadCanvasDocument, loadCanvasElements, saveCanvasElement, updateCanvas } from '@/lib/api';
import { useCanvasEngine } from '@/hooks/useCanvasEngine';
import { CanvasToolbar } from './CanvasToolbar';

interface CanvasViewProps {
  canvasId: string;
  onBack: () => void;
  onCanvasUpdated?: (canvas: CanvasDocument) => void;
}

interface TextEditorState { position: Point; value: string }
const shapeTools = new Set<CanvasTool>(['rectangle', 'circle', 'triangle', 'arrow', 'line']);

export function CanvasView({ canvasId, onBack, onCanvasUpdated }: CanvasViewProps) {
  const [canvas, setCanvas] = useState<CanvasDocument | null>(null);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [unsavedWarning, setUnsavedWarning] = useState(false);
  const [activeTool, setActiveTool] = useState<CanvasTool>('hand');
  const [activeColor, setActiveColor] = useState('#9c4a26');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [selection, setSelection] = useState<string[]>([]);
  const [erasing, setErasing] = useState<string[]>([]);
  const [draft, setDraft] = useState<CanvasElement | null>(null);
  const [textEditor, setTextEditor] = useState<TextEditorState | null>(null);
  const [canvasSupported, setCanvasSupported] = useState(true);
  const dragRef = useRef<{ clientX: number; clientY: number; start?: Point; stroke?: Point[] } | null>(null);
  const thumbnailTimer = useRef<number | null>(null);

  const previewElements = useMemo(() => draft ? [...elements, draft] : elements, [draft, elements]);
  const renderOverlay = useCallback((context: CanvasRenderingContext2D, viewport: ViewportTransform) => {
    const drawBounds = (id: string, color: string, dashed = false) => {
      const element = previewElements.find(item => item.id === id);
      if (!element) return;
      const bounds = getElementBounds(element);
      const point = worldToScreen({ x: bounds.x, y: bounds.y }, viewport);
      context.save();
      context.strokeStyle = color;
      context.lineWidth = 1.5;
      if (dashed) context.setLineDash([5, 4]);
      context.strokeRect(point.x, point.y, bounds.width * viewport.scale, bounds.height * viewport.scale);
      context.restore();
    };
    selection.forEach(id => drawBounds(id, '#9c4a26'));
    erasing.forEach(id => drawBounds(id, '#a23f34', true));
  }, [erasing, previewElements, selection]);
  const canvasReady = !loading && !loadError && canvas !== null;
  const engine = useCanvasEngine({ elements: previewElements, onRenderOverlay: renderOverlay, enabled: canvasReady });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [document, loadedElements] = await Promise.all([loadCanvasDocument(canvasId), loadCanvasElements(canvasId)]);
      setCanvas(document);
      setElements(loadedElements);
    } catch (error) {
      console.error('Unable to load canvas', error);
      setLoadError('Unable to load canvas. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [canvasId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const test = document.createElement('canvas');
    setCanvasSupported(Boolean(test.getContext?.('2d')));
  }, []);
  useEffect(() => () => { if (thumbnailTimer.current) window.clearTimeout(thumbnailTimer.current); }, []);

  const scheduleThumbnail = useCallback((nextElements: CanvasElement[]) => {
    if (thumbnailTimer.current) window.clearTimeout(thumbnailTimer.current);
    thumbnailTimer.current = window.setTimeout(async () => {
      const thumbnail = generateThumbnail(nextElements);
      if (!thumbnail) return;
      try {
        const updated = await updateCanvas(canvasId, { thumbnail });
        setCanvas(updated);
        onCanvasUpdated?.(updated);
      } catch (error) {
        console.error('Unable to save canvas thumbnail', error);
      }
    }, 600);
  }, [canvasId, onCanvasUpdated]);

  const persistElement = useCallback(async (element: CanvasElement) => {
    const validationError = validateCanvasElement(element);
    if (validationError) {
      console.error('Invalid canvas element:', validationError);
      return;
    }
    setElements(current => [...current, element]);
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const saved = await saveCanvasElement(element);
        setElements(current => {
          const next = current.map(item => item.id === element.id ? saved : item);
          scheduleThumbnail(next);
          return next;
        });
        setNotice(null);
        setUnsavedWarning(false);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < 3) {
          setNotice(`Failed to save. Retrying (${attempt}/3)…`);
          await new Promise(resolve => window.setTimeout(resolve, 250 * (2 ** (attempt - 1))));
        }
      }
    }
    console.error('Unable to save canvas element', lastError);
    setNotice('Failed to save this element. It remains visible locally.');
    setUnsavedWarning(true);
  }, [scheduleThumbnail]);

  const eraseAt = useCallback(async (point: Point) => {
    const matches = elements.filter(element => pointHitsElement(point, element));
    setErasing(matches.map(element => element.id));
    if (!matches.length) return;
    setElements(current => current.filter(element => !matches.some(match => match.id === element.id)));
    try {
      await Promise.all(matches.map(element => deleteCanvasElement(element.id)));
      setElements(current => {
        scheduleThumbnail(current);
        return current;
      });
    } catch (error) {
      console.error('Unable to erase canvas elements', error);
      setElements(current => [...current, ...matches].sort((a, b) => a.created_at.localeCompare(b.created_at)));
      setNotice('Could not erase an element. It has been restored.');
    }
  }, [elements, scheduleThumbnail]);

  const selectTool = (tool: CanvasTool) => {
    dragRef.current = null;
    setDraft(null);
    setTextEditor(null);
    setErasing([]);
    setActiveTool(tool);
  };

  const finalizeText = () => {
    if (!textEditor) return;
    const content = textEditor.value.trim();
    setTextEditor(null);
    if (!content) return;
    const now = new Date().toISOString();
    void persistElement({ id: createCanvasId(), canvas_id: canvasId, type: 'text', position: textEditor.position, color: activeColor, strokeWidth, content, fontSize: 18, fontFamily: 'Newsreader, Georgia, serif', created_at: now, updated_at: now });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      if (activeTool !== 'text') event.currentTarget.setPointerCapture(event.pointerId);
      const point = engine.screenToCanvas(event.clientX, event.clientY);
      if (!point) return;
      if (activeTool === 'text') {
        finalizeText();
        setTextEditor({ position: point, value: '' });
      } else if (activeTool === 'hand') {
        dragRef.current = { clientX: event.clientX, clientY: event.clientY };
      } else if (activeTool === 'pen' || activeTool === 'pencil') {
        dragRef.current = { clientX: event.clientX, clientY: event.clientY, stroke: [point] };
      } else if (shapeTools.has(activeTool)) {
        dragRef.current = { clientX: event.clientX, clientY: event.clientY, start: point };
      } else if (activeTool === 'eraser') {
        void eraseAt(point);
      } else if (activeTool === 'select') {
        const selected = [...elements].reverse().find(element => pointHitsElement(point, element));
        setSelection(selected ? [selected.id] : []);
      }
    } catch (error) {
      console.error('Canvas pointer down failed', error);
      dragRef.current = null;
      setDraft(null);
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      const point = engine.screenToCanvas(event.clientX, event.clientY);
      if (!point) return;
      if (activeTool === 'eraser' && event.buttons) { void eraseAt(point); return; }
      const drag = dragRef.current;
      if (!drag) return;
      if (activeTool === 'hand') {
        engine.panBy(event.clientX - drag.clientX, event.clientY - drag.clientY);
        drag.clientX = event.clientX;
        drag.clientY = event.clientY;
      } else if ((activeTool === 'pen' || activeTool === 'pencil') && drag.stroke) {
        const previous = drag.stroke[drag.stroke.length - 1];
        if (Math.hypot(point.x - previous.x, point.y - previous.y) >= 1.5) {
          drag.stroke = [...drag.stroke, point];
          const now = new Date().toISOString();
          setDraft({ id: 'draft-stroke', canvas_id: canvasId, type: 'stroke', position: drag.stroke[0], points: drag.stroke, tool: activeTool, color: activeColor, strokeWidth, created_at: now, updated_at: now });
        }
      } else if (shapeTools.has(activeTool) && drag.start) {
        setDraft(createShapeElement(activeTool, canvasId, drag.start, point, activeColor, strokeWidth));
      }
    } catch (error) {
      console.error('Canvas pointer move failed', error);
      dragRef.current = null;
      setDraft(null);
    }
  };

  const handlePointerUp = () => {
    try {
      const drag = dragRef.current;
      if ((activeTool === 'pen' || activeTool === 'pencil') && drag?.stroke && drag.stroke.length >= 2) {
        const now = new Date().toISOString();
        void persistElement({ id: createCanvasId(), canvas_id: canvasId, type: 'stroke', position: drag.stroke[0], points: drag.stroke, tool: activeTool, color: activeColor, strokeWidth, created_at: now, updated_at: now });
      } else if (shapeTools.has(activeTool) && draft) {
        void persistElement(draft);
      }
    } catch (error) {
      console.error('Canvas pointer up failed', error);
    } finally {
      dragRef.current = null;
      setDraft(null);
      setErasing([]);
    }
  };

  if (!canvasSupported) return <CanvasMessage title="Your browser does not support the canvas feature." onBack={onBack} detail="Please use a current version of Chrome, Firefox, Safari, or Edge." />;
  if (loading) return <div className="h-full min-h-[60vh] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-terracotta-500" /></div>;
  if (loadError || !canvas) return <CanvasMessage title={loadError || 'Canvas not found.'} onBack={onBack} detail="You can return to the dashboard and choose another canvas." onRetry={() => void load()} />;

  const textScreenPosition = textEditor ? engine.canvasToScreen(textEditor.position) : null;
  return (
    <section className="relative h-full min-h-[calc(100vh-4.5rem)] overflow-hidden rounded-none bg-cream-100 lg:min-h-screen" aria-label={`Canvas: ${canvas.title}`}>
      <canvas
        ref={engine.canvasRef}
        className={`absolute inset-0 h-full w-full touch-none ${activeTool === 'hand' ? 'cursor-grab' : activeTool === 'text' ? 'cursor-text' : 'cursor-crosshair'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={event => { event.preventDefault(); engine.zoom(event.deltaY, event.clientX, event.clientY); }}
      />
      <CanvasToolbar activeTool={activeTool} onSelectTool={selectTool} activeColor={activeColor} onSelectColor={setActiveColor} strokeWidth={strokeWidth} onChangeStrokeWidth={setStrokeWidth} />
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-lg border border-cream-200 bg-cream-50/95 px-3 py-2 text-xs text-warmgray-500 shadow-soft backdrop-blur-sm">
        <span className="font-serif text-ink-700 truncate max-w-40">{canvas.title}</span>
        <span>{Math.round(engine.viewport.scale * 100)}%</span>
      </div>
      {textEditor && textScreenPosition && (
        <input
          autoFocus
          aria-label="Canvas text"
          value={textEditor.value}
          onChange={event => setTextEditor(current => current ? { ...current, value: event.target.value } : current)}
          onBlur={finalizeText}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); finalizeText(); } if (event.key === 'Escape') setTextEditor(null); }}
          className="absolute z-20 min-w-40 border-b-2 border-terracotta-400 bg-cream-50/90 px-1 py-0.5 outline-none"
          style={{ left: textScreenPosition.x, top: textScreenPosition.y, color: activeColor, fontFamily: 'Newsreader, Georgia, serif', fontSize: 18 }}
        />
      )}
      {(notice || unsavedWarning) && <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-gold-200 bg-gold-50 px-4 py-2 text-sm text-ink-700 shadow-lifted">{notice || 'Some elements are unsaved. Keep this tab open and try again later.'}</div>}
    </section>
  );
}

function CanvasMessage({ title, detail, onBack, onRetry }: { title: string; detail: string; onBack: () => void; onRetry?: () => void }) {
  return <div className="h-full min-h-[60vh] flex items-center justify-center text-center px-6"><div><AlertTriangle className="mx-auto mb-3 h-8 w-8 text-terracotta-500" /><p className="font-serif text-xl text-ink-700">{title}</p><p className="mt-2 text-sm text-warmgray-500">{detail}</p><div className="mt-5 flex justify-center gap-3"><button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-lg bg-cream-200 px-3 py-2 text-sm text-ink-700"><ArrowLeft className="w-4 h-4" />Back to dashboard</button>{onRetry && <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-lg bg-terracotta-500 px-3 py-2 text-sm text-white"><RotateCcw className="w-4 h-4" />Retry</button>}</div></div></div>;
}
