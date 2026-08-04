import { Check } from 'lucide-react';
import { CANVAS_COLORS } from '@/types/canvas';

interface CanvasColorPaletteProps {
  activeColor: string;
  onSelectColor: (color: string) => void;
}

export function CanvasColorPalette({ activeColor, onSelectColor }: CanvasColorPaletteProps) {
  return (
    <div className="grid grid-cols-4 gap-1.5" aria-label="Canvas colors">
      {CANVAS_COLORS.map(color => (
        <button
          key={color}
          type="button"
          aria-label={`Use ${color}`}
          aria-pressed={activeColor === color}
          onClick={() => onSelectColor(color)}
          className={`w-7 h-7 rounded-md border-2 flex items-center justify-center transition-transform hover:scale-105 ${activeColor === color ? 'border-ink-700' : 'border-transparent'}`}
          style={{ backgroundColor: color }}
        >
          {activeColor === color && <Check className={color === '#ffffff' || color === '#c8973f' ? 'text-ink-700 w-3.5 h-3.5' : 'text-white w-3.5 h-3.5'} strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}
