// Add this test file: src/test/canvas-rendering.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  renderStroke,
  renderRectangle,
  renderCircle,
} from '@/lib/renderers';
import type { StrokeElement, RectangleElement, CircleElement } from '@/types/canvas';

describe('Element Rendering Functions', () => {
  let mockCtx: any;
  
  beforeEach(() => {
    mockCtx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      rect: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      strokeStyle: '',
      lineWidth: 0,
      fillStyle: '',
      textBaseline: '',
      font: '',
      measureText: vi.fn().mockReturnValue({ width: 50 }),
      fillText: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      clearRect: vi.fn(),
    };
  });

  describe('renderStroke', () => {
    it('should render stroke points correctly', () => {
      const strokeElement: StrokeElement = {
        id: 'test-stroke',
        canvas_id: 'test-canvas',
        type: 'stroke',
        position: { x: 0, y: 0 },
        color: '#000000',
        strokeWidth: 2,
        points: [
          { x: 10, y: 10 },
          { x: 20, y: 20 },
          { x: 30, y: 30 }
        ],
        tool: 'pen',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      renderStroke(mockCtx, strokeElement);

      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.moveTo).toHaveBeenCalledWith(10, 10);
      expect(mockCtx.lineTo).toHaveBeenCalledWith(20, 20);
      expect(mockCtx.lineTo).toHaveBeenCalledWith(30, 30);
      expect(mockCtx.stroke).toHaveBeenCalled();
      expect(mockCtx.strokeStyle).toBe('#000000');
      expect(mockCtx.lineWidth).toBe(2);
    });
  });

  describe('renderRectangle', () => {
    it('should render filled rectangle', () => {
      const rectElement: RectangleElement = {
        id: 'test-rect',
        canvas_id: 'test-canvas',
        type: 'rectangle',
        position: { x: 10, y: 10 },
        color: '#FF0000',
        strokeWidth: 1,
        width: 100,
        height: 50,
        filled: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      renderRectangle(mockCtx, rectElement);

      expect(mockCtx.rect).toHaveBeenCalledWith(10, 10, 100, 50);
      expect(mockCtx.fill).toHaveBeenCalled();
      expect(mockCtx.fillStyle).toBe('#FF0000');
    });

    it('should render outlined rectangle', () => {
      const rectElement: RectangleElement = {
        id: 'test-rect-outlined',
        canvas_id: 'test-canvas',
        type: 'rectangle',
        position: { x: 10, y: 10 },
        color: '#0000FF',
        strokeWidth: 1,
        width: 100,
        height: 50,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        filled: false,
      };

      renderRectangle(mockCtx, rectElement);

      expect(mockCtx.stroke).toHaveBeenCalled();
    });
  });

  describe('renderCircle', () => {
    it('should render filled circle', () => {
      const circleElement: CircleElement = {
        id: 'test-circle',
        canvas_id: 'test-canvas',
        type: 'circle',
        position: { x: 50, y: 50 },
        color: '#00FF00',
        strokeWidth: 2,
        radius: 25,
        filled: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      renderCircle(mockCtx, circleElement);

      expect(mockCtx.arc).toHaveBeenCalledWith(50, 50, 25, 0, Math.PI * 2);
      expect(mockCtx.fill).toHaveBeenCalled();
    });
  });
});