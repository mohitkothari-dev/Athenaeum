import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, Edit3, Loader2, RotateCcw, Trash2, X } from 'lucide-react';
import type { CanvasDocument, CanvasElement, CanvasTool, Point, TextElement, ViewportTransform } from '@/types/canvas';
import {
  createCanvasId,
  createShapeElement,
  generateThumbnail,
  getElementBounds,
  getElementsInRect,
  moveElement,
  pointHitsElement,
  validateCanvasElement,
  worldToScreen,
} from '@/lib/canvas';
import { deleteCanvasElement, loadCanvasDocument, loadCanvasElements, saveCanvasElement, updateCanvas } from '@/lib/api';
import { useCanvasEngine } from '@/hooks/useCanvasEngine';
import { CanvasToolbar } from './CanvasToolbar';

interface CanvasViewProps {
  canvasId: string;
  onBack: () => void;
  onCanvasUpdated?: (canvas: CanvasDocument) => void;
}

interface TextEditorState {
  position: Point;
  value: string;
  editingId?: string;
  fontSize?: number;
  fontFamily?: string;
}

interface DragState {
  clientX: number;
  clientY: number;
  start?: Point;
  lastPoint?: Point;
  stroke?: Point[];
  marqueeStart?: Point;
  isMoving?: boolean;
  moved?: boolean;
}

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
  const [marquee, setMarquee] = useState<{ start: Point; current: Point } | null>(null);
  const [textEditor, setTextEditor] = useState<TextEditorState | null>(null);
  const [canvasSupported, setCanvasSupported] = useState(true);

  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const thumbnailTimer = useRef<number | null>(null);

  const previewElements = useMemo(() => draft ? [...elements, draft] : elements, [draft, elements]);

  const renderOverlay = useCallback((context: CanvasRenderingContext2D, viewport: ViewportTransform) => {
    // Render selected elements' bounding boxes with handles
    selection.forEach(id => {
      const element = previewElements.find(item => item.id === id);
      if (!element) return;
      const bounds = getElementBounds(element);
      const point = worldToScreen({ x: bounds.x, y: bounds.y }, viewport);
      const width = bounds.width * viewport.scale;
      const height = bounds.height * viewport.scale;

      context.save();
      context.strokeStyle = '#9c4a26';
      context.lineWidth = 1.5;
      context.setLineDash([4, 3]);
      context.strokeRect(point.x, point.y, width, height);

      // Draw 4 corner handles
      context.setLineDash([]);
      context.fillStyle = '#ffffff';
      context.strokeStyle = '#9c4a26';
      context.lineWidth = 1.5;
      const handleSize = 6;
      const corners = [
        { x: point.x, y: point.y },
        { x: point.x + width, y: point.y },
        { x: point.x, y: point.y + height },
        { x: point.x + width, y: point.y + height },
      ];
      corners.forEach(c => {
        context.fillRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
        context.strokeRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
      });
      context.restore();
    });

    // Render erasing bounds
    erasing.forEach(id => {
      const element = previewElements.find(item => item.id === id);
      if (!element) return;
      const bounds = getElementBounds(element);
      const point = worldToScreen({ x: bounds.x, y: bounds.y }, viewport);
      context.save();
      context.strokeStyle = '#a23f34';
      context.lineWidth = 1.5;
      context.setLineDash([5, 4]);
      context.strokeRect(point.x, point.y, bounds.width * viewport.scale, bounds.height * viewport.scale);
      context.restore();
    });

    // Render marquee selection rectangle
    if (marquee) {
      const p1 = worldToScreen(marquee.start, viewport);
      const p2 = worldToScreen(marquee.current, viewport);
      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y);
      const w = Math.abs(p2.x - p1.x);
      const h = Math.abs(p2.y - p1.y);

      context.save();
      context.fillStyle = 'rgba(156, 74, 38, 0.08)';
      context.strokeStyle = '#9c4a26';
      context.lineWidth = 1;
      context.setLineDash([4, 4]);
      context.fillRect(x, y, w, h);
      context.strokeRect(x, y, w, h);
      context.restore();
    }
  }, [erasing, marquee, previewElements, selection]);

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

  // Focus textarea only when the editor first opens (position or editingId changes),
  // NOT on every keystroke — otherwise select() would replace all text each time the user types.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (textEditor && textInputRef.current) {
      textInputRef.current.focus();
      textInputRef.current.select();
    }
  // Depend on position coords and editingId so this only fires when the editor session changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textEditor?.position.x, textEditor?.position.y, textEditor?.editingId]);

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
    setElements(current => {
      const exists = current.some(e => e.id === element.id);
      return exists ? current.map(item => item.id === element.id ? element : item) : [...current, element];
    });

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

  const deleteSelected = useCallback(async () => {
    if (!selection.length) return;
    const targetIds = [...selection];
    setSelection([]);
    setElements(current => current.filter(el => !targetIds.includes(el.id)));
    try {
      await Promise.all(targetIds.map(id => deleteCanvasElement(id)));
      setElements(current => {
        scheduleThumbnail(current);
        return current;
      });
    } catch (error) {
      console.error('Unable to delete selected canvas elements', error);
      void load();
      setNotice('Could not delete elements. Workspace restored.');
    }
  }, [load, scheduleThumbnail, selection]);

  // Keyboard shortcut listener (Delete/Backspace to delete selection, Escape to clear selection)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.getAttribute('contenteditable') === 'true');
      if (isInput) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selection.length > 0) {
          event.preventDefault();
          void deleteSelected();
        }
      } else if (event.key === 'Escape') {
        setSelection([]);
        setTextEditor(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected, selection]);

  // Color selection change for selected elements
  const handleColorChange = (color: string) => {
    setActiveColor(color);
    if (selection.length > 0) {
      setElements(current =>
        current.map(el => {
          if (selection.includes(el.id)) {
            const updated = { ...el, color, updated_at: new Date().toISOString() };
            void persistElement(updated);
            return updated;
          }
          return el;
        })
      );
    }
  };

  // Stroke width change for selected elements
  const handleStrokeWidthChange = (width: number) => {
    setStrokeWidth(width);
    if (selection.length > 0) {
      setElements(current =>
        current.map(el => {
          if (selection.includes(el.id)) {
            const updated = { ...el, strokeWidth: width, updated_at: new Date().toISOString() };
            void persistElement(updated);
            return updated;
          }
          return el;
        })
      );
    }
  };

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
    setMarquee(null);
    setActiveTool(tool);
  };

  const finalizeText = () => {
    if (!textEditor) return;
    const content = textEditor.value.trim();
    const editingId = textEditor.editingId;
    const position = textEditor.position;
    const fontSize = textEditor.fontSize || 18;
    const fontFamily = textEditor.fontFamily || 'Newsreader, Georgia, serif';

    setTextEditor(null);
    if (!content) return;

    const now = new Date().toISOString();
    if (editingId) {
      const existing = elements.find(el => el.id === editingId);
      if (existing && existing.type === 'text') {
        const updated: TextElement = {
          ...existing,
          content,
          color: activeColor,
          updated_at: now,
        };
        void persistElement(updated);
      }
    } else {
      const newText: TextElement = {
        id: createCanvasId(),
        canvas_id: canvasId,
        type: 'text',
        position,
        color: activeColor,
        strokeWidth: 1,
        content,
        fontSize,
        fontFamily,
        created_at: now,
        updated_at: now,
      };
      void persistElement(newText);
    }
  };

  const startEditText = (element: TextElement) => {
    setTextEditor({
      position: element.position,
      value: element.content,
      editingId: element.id,
      fontSize: element.fontSize,
      fontFamily: element.fontFamily,
    });
    setActiveColor(element.color);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      if (activeTool !== 'text') event.currentTarget.setPointerCapture(event.pointerId);
      const point = engine.screenToCanvas(event.clientX, event.clientY);
      if (!point) return;

      if (activeTool === 'text') {
        finalizeText();
        // Check if user clicked on an existing text element to edit it
        const clickedText = [...elements].reverse().find(el => el.type === 'text' && pointHitsElement(point, el)) as TextElement | undefined;
        if (clickedText) {
          startEditText(clickedText);
        } else {
          setTextEditor({ position: point, value: '' });
        }
      } else if (activeTool === 'hand') {
        dragRef.current = { clientX: event.clientX, clientY: event.clientY };
      } else if (activeTool === 'pen' || activeTool === 'pencil') {
        dragRef.current = { clientX: event.clientX, clientY: event.clientY, stroke: [point] };
      } else if (shapeTools.has(activeTool)) {
        dragRef.current = { clientX: event.clientX, clientY: event.clientY, start: point };
      } else if (activeTool === 'eraser') {
        void eraseAt(point);
      } else if (activeTool === 'select') {
        const hit = [...elements].reverse().find(element => pointHitsElement(point, element));
        if (hit) {
          const isAlreadySelected = selection.includes(hit.id);
          const newSelection = isAlreadySelected ? selection : [hit.id];
          setSelection(newSelection);
          dragRef.current = {
            clientX: event.clientX,
            clientY: event.clientY,
            lastPoint: point,
            isMoving: true,
            moved: false,
          };
        } else {
          setSelection([]);
          dragRef.current = {
            clientX: event.clientX,
            clientY: event.clientY,
            marqueeStart: point,
            moved: false,
          };
          setMarquee({ start: point, current: point });
        }
      }
    } catch (error) {
      console.error('Canvas pointer down failed', error);
      dragRef.current = null;
      setDraft(null);
      setMarquee(null);
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      const point = engine.screenToCanvas(event.clientX, event.clientY);
      if (!point) return;

      if (activeTool === 'eraser' && event.buttons) {
        void eraseAt(point);
        return;
      }
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
      } else if (activeTool === 'select') {
        if (drag.isMoving && drag.lastPoint && selection.length > 0) {
          const deltaX = point.x - drag.lastPoint.x;
          const deltaY = point.y - drag.lastPoint.y;
          if (Math.abs(deltaX) > 0.01 || Math.abs(deltaY) > 0.01) {
            drag.moved = true;
            drag.lastPoint = point;
            setElements(current => current.map(el => selection.includes(el.id) ? moveElement(el, deltaX, deltaY) : el));
          }
        } else if (drag.marqueeStart) {
          drag.moved = true;
          setMarquee({ start: drag.marqueeStart, current: point });
        }
      }
    } catch (error) {
      console.error('Canvas pointer move failed', error);
      dragRef.current = null;
      setDraft(null);
      setMarquee(null);
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
      } else if (activeTool === 'select' && drag) {
        if (drag.isMoving && drag.moved && selection.length > 0) {
          // Save updated positions of selected elements
          elements.filter(el => selection.includes(el.id)).forEach(el => void persistElement(el));
        } else if (drag.marqueeStart && marquee) {
          const rect = {
            x: marquee.start.x,
            y: marquee.start.y,
            width: marquee.current.x - marquee.start.x,
            height: marquee.current.y - marquee.start.y,
          };
          const matches = getElementsInRect(rect, elements);
          setSelection(matches.map(m => m.id));
        }
      }
    } catch (error) {
      console.error('Canvas pointer up failed', error);
    } finally {
      dragRef.current = null;
      setDraft(null);
      setErasing([]);
      setMarquee(null);
    }
  };

  // Double click handler on canvas to edit text directly
  const handleDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const point = engine.screenToCanvas(event.clientX, event.clientY);
    if (!point) return;
    const hitText = [...elements].reverse().find(el => el.type === 'text' && pointHitsElement(point, el)) as TextElement | undefined;
    if (hitText) {
      setSelection([hitText.id]);
      startEditText(hitText);
    }
  };

  if (!canvasSupported) return <CanvasMessage title="Your browser does not support the canvas feature." onBack={onBack} detail="Please use a current version of Chrome, Firefox, Safari, or Edge." />;
  if (loading) return <div className="h-full min-h-[60vh] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-terracotta-500" /></div>;
  if (loadError || !canvas) return <CanvasMessage title={loadError || 'Canvas not found.'} onBack={onBack} detail="You can return to the dashboard and choose another canvas." onRetry={() => void load()} />;

  const textScreenPosition = textEditor ? engine.canvasToScreen(textEditor.position) : null;
  const selectedElement = selection.length === 1 ? elements.find(el => el.id === selection[0]) : null;

  return (
    <section className="relative h-full min-h-[calc(100vh-4.5rem)] overflow-hidden rounded-none bg-cream-100 lg:min-h-screen" aria-label={`Canvas: ${canvas.title}`}>
      <canvas
        ref={engine.canvasRef}
        className={`absolute inset-0 h-full w-full touch-none ${
          activeTool === 'hand' ? 'cursor-grab' : activeTool === 'text' ? 'cursor-text' : activeTool === 'select' ? 'cursor-default' : 'cursor-crosshair'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onWheel={event => { event.preventDefault(); engine.zoom(event.deltaY, event.clientX, event.clientY); }}
      />
      <CanvasToolbar
        activeTool={activeTool}
        onSelectTool={selectTool}
        activeColor={activeColor}
        onSelectColor={handleColorChange}
        strokeWidth={strokeWidth}
        onChangeStrokeWidth={handleStrokeWidthChange}
      />

      {/* Top right status bar */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-lg border border-cream-200 bg-cream-50/95 px-3 py-2 text-xs text-warmgray-500 shadow-soft backdrop-blur-sm">
        <span className="font-serif text-ink-700 truncate max-w-40">{canvas.title}</span>
        <span>{Math.round(engine.viewport.scale * 100)}%</span>
      </div>

      {/* Selection context toolbar overlay */}
      {selection.length > 0 && (
        <div className="absolute top-3 left-1/2 z-20 -translate-x-1/2 flex items-center gap-2 rounded-xl border border-cream-200 bg-cream-50/95 px-3 py-1.5 shadow-lifted backdrop-blur-sm font-sans text-xs">
          <span className="font-medium text-ink-700">{selection.length} {selection.length === 1 ? 'element' : 'elements'} selected</span>
          <div className="h-4 w-px bg-cream-200" />
          {selectedElement && selectedElement.type === 'text' && (
            <button
              type="button"
              onClick={() => startEditText(selectedElement as TextElement)}
              className="flex items-center gap-1 rounded px-2 py-1 text-terracotta-700 hover:bg-cream-200 transition-colors"
              title="Edit text content"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Text</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void deleteSelected()}
            className="flex items-center gap-1 rounded px-2 py-1 text-brick-600 hover:bg-brick-50 transition-colors"
            title="Delete selected (Delete / Backspace)"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
          <button
            type="button"
            onClick={() => setSelection([])}
            className="rounded p-1 text-warmgray-400 hover:bg-cream-200 hover:text-ink-700 transition-colors"
            title="Deselect (Escape)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Text Editor Overlay */}
      {textEditor && textScreenPosition && (
        <div
          className="absolute z-30 flex flex-col gap-1.5 rounded-lg border border-terracotta-300 bg-cream-50 p-2 shadow-lifted"
          style={{ left: Math.max(16, textScreenPosition.x), top: Math.max(16, textScreenPosition.y) }}
        >
          <textarea
            ref={textInputRef}
            aria-label="Canvas text input"
            rows={2}
            value={textEditor.value}
            placeholder="Type text here…"
            onChange={event => { const value = event.target.value; setTextEditor(current => current ? { ...current, value } : current); }}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                finalizeText();
              } else if (event.key === 'Escape') {
                setTextEditor(null);
              }
            }}
            className="min-w-56 max-w-xs border-0 bg-transparent p-1 font-serif text-base text-ink-800 outline-none resize-y"
            style={{ color: activeColor, fontFamily: textEditor.fontFamily || 'Newsreader, Georgia, serif', fontSize: textEditor.fontSize || 18 }}
          />
          <div className="flex items-center justify-between border-t border-cream-200 pt-1.5 text-xs text-warmgray-400">
            <span>Enter to save, Shift+Enter for new line</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setTextEditor(null)}
                className="rounded px-2 py-1 text-warmgray-500 hover:bg-cream-200 hover:text-ink-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={finalizeText}
                className="inline-flex items-center gap-1 rounded bg-terracotta-600 px-2.5 py-1 text-white hover:bg-terracotta-700 transition-colors font-medium"
              >
                <Check className="w-3 h-3" />
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {(notice || unsavedWarning) && (
        <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-gold-200 bg-gold-50 px-4 py-2 text-sm text-ink-700 shadow-lifted">
          {notice || 'Some elements are unsaved. Keep this tab open and try again later.'}
        </div>
      )}
    </section>
  );
}

function CanvasMessage({ title, detail, onBack, onRetry }: { title: string; detail: string; onBack: () => void; onRetry?: () => void }) {
  return (
    <div className="h-full min-h-[60vh] flex items-center justify-center text-center px-6">
      <div>
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-terracotta-500" />
        <p className="font-serif text-xl text-ink-700">{title}</p>
        <p className="mt-2 text-sm text-warmgray-500">{detail}</p>
        <div className="mt-5 flex justify-center gap-3">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-lg bg-cream-200 px-3 py-2 text-sm text-ink-700">
            <ArrowLeft className="w-4 h-4" />Back to dashboard
          </button>
          {onRetry && (
            <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-lg bg-terracotta-500 px-3 py-2 text-sm text-white">
              <RotateCcw className="w-4 h-4" />Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
