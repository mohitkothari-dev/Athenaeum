import { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Loader2,
  Pencil,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import type { CanvasDocument } from '@/types/canvas';
// Define formatDate inline to resolve missing module import
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
};

interface CanvasSidebarSectionProps {
  canvases: CanvasDocument[];
  canvasesLoading: boolean;
  activeCanvasId?: string;
  onNavigateCanvas: (canvasId: string) => void;
  onCreateCanvas: () => Promise<void>;
  onDeleteCanvas: (canvasId: string) => Promise<void>;
  onRenameCanvas: (canvasId: string, title: string) => Promise<void>;
}

export default function CanvasSidebarSection({
  canvases,
  canvasesLoading,
  activeCanvasId,
  onNavigateCanvas,
  onCreateCanvas,
  onDeleteCanvas,
  onRenameCanvas,
}: CanvasSidebarSectionProps) {
  const [creatingCanvas, setCreatingCanvas] = useState(false);
  const [renamingCanvasId, setRenamingCanvasId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');
  const [showMenuCanvasId, setShowMenuCanvasId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenuCanvasId) return;
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenuCanvasId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenuCanvasId]);

  const handleCreateCanvas = async () => {
    setCreatingCanvas(true);
    try {
      await onCreateCanvas();
    } finally {
      setCreatingCanvas(false);
    }
  };

  const handleRenameStart = (canvasId: string, title: string) => {
    setRenamingCanvasId(canvasId);
    setRenamingValue(title);
  };

  const handleRenameSubmit = async (canvasId: string) => {
    const trimmed = renamingValue.trim();
    if (trimmed) {
      await onRenameCanvas(canvasId, trimmed);
    }
    setRenamingCanvasId(null);
    setRenamingValue('');
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, canvasId: string) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(canvasId);
    } else if (e.key === 'Escape') {
      setRenamingCanvasId(null);
      setRenamingValue('');
    }
  };

  return (
    <div className="px-3">
      {/* Canvas header and new canvas button */}
      <div className="flex items-center justify-between px-2 py-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-warmgray-400">
          MY CANVASES
        </div>
        <button
          onClick={handleCreateCanvas}
          disabled={creatingCanvas}
          className="w-6 h-6 rounded-md flex items-center justify-center text-warmgray-400 hover:text-ink-600 hover:bg-cream-200 transition-colors"
          title="New canvas"
        >
          {creatingCanvas ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
          ) : (
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          )}
        </button>
      </div>

      {/* Canvas list */}
      {canvasesLoading ? (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-warmgray-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
          Loading canvases...
        </div>
      ) : canvases.length === 0 ? (
        <div className="px-3 py-3 text-center">
          <p className="text-xs text-warmgray-400 mb-2">No canvases yet</p>
          <button
            onClick={handleCreateCanvas}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cream-200/60 text-xs font-medium text-warmgray-500 hover:bg-cream-200 hover:text-ink-600 transition-colors"
          >
            <Pencil className="w-3 h-3" strokeWidth={2} />
            Create your first canvas
          </button>
        </div>
      ) : (
        <div className="mt-0.5 space-y-0.5">
          {canvases.map((canvas) => {
            const isActive = activeCanvasId === canvas.id;
            const isRenaming = renamingCanvasId === canvas.id;

            return (
              <div key={canvas.id}>
                {/* Canvas item */}
                <div
                  ref={showMenuCanvasId === canvas.id ? menuRef : undefined}
                  className={`group flex items-center rounded-lg transition-all relative ${
                    isActive
                      ? 'bg-cream-200 text-ink-700'
                      : 'text-warmgray-500 hover:bg-cream-200/60 hover:text-ink-600'
                  }`}
                >
                  {/* Expand/collapse toggle for canvas items with elements */}
                  {isRenaming ? (
                    <input
                      autoFocus
                      value={renamingValue}
                      onChange={(e) => setRenamingValue(e.target.value)}
                      onBlur={() => handleRenameSubmit(canvas.id)}
                      onKeyDown={(e) => handleRenameKeyDown(e, canvas.id)}
                      className="flex-1 text-[13px] bg-cream-50 border border-cream-300 rounded px-1.5 py-0.5 text-ink-700 focus:outline-none focus:border-terracotta-300 min-w-0"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <button
                      onClick={() => onNavigateCanvas(canvas.id)}
                      onDoubleClick={() => handleRenameStart(canvas.id, canvas.title)}
                      className="flex-1 flex items-center gap-1.5 py-1.5 pr-1 min-w-0 text-left"
                    >
                      <span className="text-sm flex-shrink-0">{canvas.icon || '🎨'}</span>
                      <div className="flex-1 min-w-0">
                        <span className={`text-[13px] truncate ${isActive ? 'font-medium' : ''}`}>
                          {canvas.title || 'Untitled Canvas'}
                        </span>
                        <div className="text-[10px] text-warmgray-400 mt-0.5">
                          {formatDate(canvas.created_at)}
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Context menu trigger */}
                  {!isRenaming && (
                    <div
                      className={`flex items-center gap-0.5 pr-1.5 flex-shrink-0 transition-opacity ${
                        showMenuCanvasId === canvas.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenuCanvasId(showMenuCanvasId === canvas.id ? null : canvas.id);
                        }}
                        className="w-5 h-5 rounded flex items-center justify-center text-warmgray-400 hover:text-ink-600 hover:bg-cream-300/50 transition-colors"
                        title="More options"
                      >
                        <MoreHorizontal className="w-3 h-3" strokeWidth={2} />
                      </button>
                    </div>
                  )}

                  {/* Dropdown menu */}
                  {showMenuCanvasId === canvas.id && !isRenaming && (
                    <div
                      className="absolute right-0 top-full mt-1 w-40 bg-cream-50 border border-cream-200 rounded-xl shadow-lifted z-50 py-1 animate-fade-in-soft"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          handleRenameStart(canvas.id, canvas.title || '');
                          setShowMenuCanvasId(null);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-warmgray-600 hover:bg-cream-100 hover:text-ink-600 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                        Rename
                      </button>
                      <button
                        onClick={() => {
                          setShowMenuCanvasId(null);
                          if (confirm('Delete this canvas? This cannot be undone.')) {
                            void onDeleteCanvas(canvas.id);
                          }
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-brick-500 hover:bg-brick-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}