import {
  ArrowRight, Circle, Eraser, Hand, Minus, MousePointer2, PenTool, Pencil, Square, Triangle, Type,
} from 'lucide-react';
import type { CanvasTool } from '@/types/canvas';
import { CanvasColorPalette } from './CanvasColorPalette';

interface CanvasToolbarProps {
  activeTool: CanvasTool;
  onSelectTool: (tool: CanvasTool) => void;
  activeColor: string;
  onSelectColor: (color: string) => void;
  strokeWidth: number;
  onChangeStrokeWidth: (width: number) => void;
}

const tools: Array<{ tool: CanvasTool; label: string; Icon: typeof Hand }> = [
  { tool: 'hand', label: 'Pan canvas', Icon: Hand },
  { tool: 'select', label: 'Select elements', Icon: MousePointer2 },
  { tool: 'pen', label: 'Pen', Icon: PenTool },
  { tool: 'pencil', label: 'Pencil', Icon: Pencil },
  { tool: 'eraser', label: 'Eraser', Icon: Eraser },
  { tool: 'rectangle', label: 'Rectangle', Icon: Square },
  { tool: 'circle', label: 'Circle', Icon: Circle },
  { tool: 'triangle', label: 'Triangle', Icon: Triangle },
  { tool: 'arrow', label: 'Arrow', Icon: ArrowRight },
  { tool: 'line', label: 'Line', Icon: Minus },
  { tool: 'text', label: 'Text', Icon: Type },
];

export function CanvasToolbar({ activeTool, onSelectTool, activeColor, onSelectColor, strokeWidth, onChangeStrokeWidth }: CanvasToolbarProps) {
  return (
    <aside className="absolute left-3 top-3 z-10 w-44 rounded-xl border border-cream-200 bg-cream-50/95 p-2 shadow-lifted backdrop-blur-sm font-sans">
      <div className="grid grid-cols-4 gap-1" aria-label="Canvas tools">
        {tools.map(({ tool, label, Icon }) => (
          <button
            key={tool}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={activeTool === tool}
            onClick={() => onSelectTool(tool)}
            className={`h-8 rounded-md flex items-center justify-center transition-colors ${activeTool === tool ? 'bg-terracotta-100 text-terracotta-700' : 'text-warmgray-500 hover:bg-cream-200 hover:text-ink-700'}`}
          >
            <Icon className="w-4 h-4" strokeWidth={1.7} />
          </button>
        ))}
      </div>
      <div className="my-2 border-t border-cream-200" />
      <CanvasColorPalette activeColor={activeColor} onSelectColor={onSelectColor} />
      <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-warmgray-400">
        Stroke {strokeWidth}px
        <input
          aria-label="Stroke width"
          className="mt-1.5 w-full accent-terracotta-600"
          type="range"
          min="1"
          max="20"
          value={strokeWidth}
          onChange={event => onChangeStrokeWidth(Math.max(1, Math.min(20, Number(event.target.value))))}
        />
      </label>
    </aside>
  );
}
