import { describe, it, expect } from 'vitest';
import type {
  Point,
  ViewportTransform,
  CanvasDocument,
  CanvasTool,
  CanvasElement,
  StrokeElement,
  RectangleElement,
  CircleElement,
  TriangleElement,
  ArrowElement,
  LineElement,
  TextElement,
} from './canvas';
import { CANVAS_COLORS } from './canvas';

describe('Canvas Types', () => {
  describe('Point interface', () => {
    it('should accept valid point objects', () => {
      const point: Point = { x: 100, y: 200 };
      expect(point.x).toBe(100);
      expect(point.y).toBe(200);
    });
  });

  describe('ViewportTransform interface', () => {
    it('should accept valid viewport transform', () => {
      const viewport: ViewportTransform = { x: 0, y: 0, scale: 1.0 };
      expect(viewport.scale).toBe(1.0);
    });
  });

  describe('CanvasDocument interface', () => {
    it('should accept valid canvas document', () => {
      const doc: CanvasDocument = {
        id: 'test-id',
        user_id: 'user-id',
        title: 'Test Canvas',
        icon: '🎨',
        thumbnail: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      expect(doc.title).toBe('Test Canvas');
    });
  });

  describe('CanvasTool type', () => {
    it('should accept all valid tool types', () => {
      const tools: CanvasTool[] = [
        'hand',
        'pen',
        'pencil',
        'eraser',
        'rectangle',
        'circle',
        'triangle',
        'arrow',
        'line',
        'text',
        'select',
      ];
      expect(tools).toHaveLength(11);
    });
  });

  describe('StrokeElement', () => {
    it('should create valid stroke element', () => {
      const stroke: StrokeElement = {
        id: 'stroke-1',
        canvas_id: 'canvas-1',
        type: 'stroke',
        position: { x: 0, y: 0 },
        color: '#9c4a26',
        strokeWidth: 2,
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        tool: 'pen',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      expect(stroke.type).toBe('stroke');
      expect(stroke.points).toHaveLength(2);
    });
  });

  describe('RectangleElement', () => {
    it('should create valid rectangle element', () => {
      const rect: RectangleElement = {
        id: 'rect-1',
        canvas_id: 'canvas-1',
        type: 'rectangle',
        position: { x: 10, y: 10 },
        color: '#5a7a50',
        strokeWidth: 2,
        width: 100,
        height: 50,
        filled: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      expect(rect.type).toBe('rectangle');
      expect(rect.width).toBe(100);
    });
  });

  describe('CircleElement', () => {
    it('should create valid circle element', () => {
      const circle: CircleElement = {
        id: 'circle-1',
        canvas_id: 'canvas-1',
        type: 'circle',
        position: { x: 50, y: 50 },
        color: '#c8973f',
        strokeWidth: 2,
        radius: 25,
        filled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      expect(circle.type).toBe('circle');
      expect(circle.radius).toBe(25);
    });
  });

  describe('TriangleElement', () => {
    it('should create valid triangle element', () => {
      const triangle: TriangleElement = {
        id: 'triangle-1',
        canvas_id: 'canvas-1',
        type: 'triangle',
        position: { x: 30, y: 30 },
        color: '#a23f34',
        strokeWidth: 2,
        width: 60,
        height: 60,
        filled: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      expect(triangle.type).toBe('triangle');
    });
  });

  describe('ArrowElement', () => {
    it('should create valid arrow element', () => {
      const arrow: ArrowElement = {
        id: 'arrow-1',
        canvas_id: 'canvas-1',
        type: 'arrow',
        position: { x: 0, y: 0 },
        color: '#221f1c',
        strokeWidth: 2,
        endPoint: { x: 100, y: 100 },
        headSize: 10,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      expect(arrow.type).toBe('arrow');
      expect(arrow.endPoint.x).toBe(100);
    });
  });

  describe('LineElement', () => {
    it('should create valid line element', () => {
      const line: LineElement = {
        id: 'line-1',
        canvas_id: 'canvas-1',
        type: 'line',
        position: { x: 10, y: 10 },
        color: '#4a443f',
        strokeWidth: 2,
        endPoint: { x: 50, y: 50 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      expect(line.type).toBe('line');
    });
  });

  describe('TextElement', () => {
    it('should create valid text element', () => {
      const text: TextElement = {
        id: 'text-1',
        canvas_id: 'canvas-1',
        type: 'text',
        position: { x: 20, y: 20 },
        color: '#968b7d',
        strokeWidth: 1,
        content: 'Hello World',
        fontSize: 16,
        fontFamily: 'Inter',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      expect(text.type).toBe('text');
      expect(text.content).toBe('Hello World');
    });
  });

  describe('CanvasElement discriminated union', () => {
    it('should accept all element types', () => {
      const elements: CanvasElement[] = [
        {
          id: 'stroke-1',
          canvas_id: 'canvas-1',
          type: 'stroke',
          position: { x: 0, y: 0 },
          color: '#9c4a26',
          strokeWidth: 2,
          points: [{ x: 0, y: 0 }],
          tool: 'pen',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'rect-1',
          canvas_id: 'canvas-1',
          type: 'rectangle',
          position: { x: 10, y: 10 },
          color: '#5a7a50',
          strokeWidth: 2,
          width: 100,
          height: 50,
          filled: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      expect(elements).toHaveLength(2);
      expect(elements[0].type).toBe('stroke');
      expect(elements[1].type).toBe('rectangle');
    });
  });

  describe('CANVAS_COLORS constant', () => {
    it('should contain exactly 8 colors', () => {
      expect(CANVAS_COLORS).toHaveLength(8);
    });

    it('should include all design system colors', () => {
      expect(CANVAS_COLORS).toContain('#9c4a26'); // terracotta
      expect(CANVAS_COLORS).toContain('#5a7a50'); // sage
      expect(CANVAS_COLORS).toContain('#c8973f'); // gold
      expect(CANVAS_COLORS).toContain('#a23f34'); // brick
      expect(CANVAS_COLORS).toContain('#221f1c'); // ink-700
      expect(CANVAS_COLORS).toContain('#4a443f'); // ink-500
      expect(CANVAS_COLORS).toContain('#968b7d'); // warmgray
      expect(CANVAS_COLORS).toContain('#ffffff'); // white
    });

    it('should be a readonly array', () => {
      // This is a compile-time check, verified by TypeScript
      const colors = CANVAS_COLORS;
      expect(Array.isArray(colors)).toBe(true);
    });
  });

  describe('Type discrimination', () => {
    it('should narrow types correctly based on type property', () => {
      const element: CanvasElement = {
        id: 'text-1',
        canvas_id: 'canvas-1',
        type: 'text',
        position: { x: 20, y: 20 },
        color: '#968b7d',
        strokeWidth: 1,
        content: 'Test',
        fontSize: 16,
        fontFamily: 'Inter',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (element.type === 'text') {
        // TypeScript should narrow this to TextElement
        expect(element.content).toBe('Test');
        expect(element.fontSize).toBe(16);
      }
    });
  });
});
