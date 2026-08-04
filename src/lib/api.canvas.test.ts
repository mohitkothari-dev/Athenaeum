import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createCanvas,
  loadCanvases,
  updateCanvas,
  deleteCanvas,
  saveCanvasElement,
  loadCanvasElements,
  deleteCanvasElement,
} from './api';
import { supabase } from './supabase';
import type { CanvasDocument, StrokeElement, RectangleElement, TextElement } from '@/types/canvas';

// Mock supabase
vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('Canvas API Functions', () => {
  const mockUserId = 'test-user-id';
  const mockCanvasId = 'test-canvas-id';
  const mockElementId = 'test-element-id';

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock authenticated session
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: mockUserId } } as any },
      error: null,
    });
  });

  describe('createCanvas', () => {
    it('should create a new canvas with default title', async () => {
      const mockCanvas: CanvasDocument = {
        id: mockCanvasId,
        user_id: mockUserId,
        title: 'Untitled Canvas',
        icon: '🎨',
        thumbnail: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockCanvas, error: null }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await createCanvas();

      expect(result).toEqual(mockCanvas);
      expect(mockFrom).toHaveBeenCalledWith('canvas_documents');
    });

    it('should create a canvas with custom title', async () => {
      const customTitle = 'My Diagram';
      const mockCanvas: CanvasDocument = {
        id: mockCanvasId,
        user_id: mockUserId,
        title: customTitle,
        icon: '🎨',
        thumbnail: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockCanvas, error: null }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await createCanvas(customTitle);

      expect(result.title).toBe(customTitle);
    });

    it('should throw error if not authenticated', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      await expect(createCanvas()).rejects.toThrow('Not authenticated');
    });

    it('should throw error on database failure', async () => {
      const mockError = new Error('Database error');
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: mockError }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      await expect(createCanvas()).rejects.toThrow('Database error');
    });
  });

  describe('loadCanvases', () => {
    it('should load all canvases for authenticated user', async () => {
      const mockCanvases: CanvasDocument[] = [
        {
          id: 'canvas-1',
          user_id: mockUserId,
          title: 'Canvas 1',
          icon: '🎨',
          thumbnail: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'canvas-2',
          user_id: mockUserId,
          title: 'Canvas 2',
          icon: '✏️',
          thumbnail: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockCanvases, error: null }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await loadCanvases();

      expect(result).toEqual(mockCanvases);
      expect(result).toHaveLength(2);
    });

    it('should return empty array if no canvases exist', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await loadCanvases();

      expect(result).toEqual([]);
    });

    it('should throw error if not authenticated', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      await expect(loadCanvases()).rejects.toThrow('Not authenticated');
    });
  });

  describe('updateCanvas', () => {
    it('should update canvas title', async () => {
      const updatedCanvas: CanvasDocument = {
        id: mockCanvasId,
        user_id: mockUserId,
        title: 'Updated Title',
        icon: '🎨',
        thumbnail: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockFrom = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updatedCanvas, error: null }),
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await updateCanvas(mockCanvasId, { title: 'Updated Title' });

      expect(result.title).toBe('Updated Title');
    });

    it('should update canvas icon', async () => {
      const updatedCanvas: CanvasDocument = {
        id: mockCanvasId,
        user_id: mockUserId,
        title: 'Canvas',
        icon: '✏️',
        thumbnail: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockFrom = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updatedCanvas, error: null }),
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await updateCanvas(mockCanvasId, { icon: '✏️' });

      expect(result.icon).toBe('✏️');
    });

    it('should throw error on database failure', async () => {
      const mockError = new Error('Update failed');
      const mockFrom = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: mockError }),
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      await expect(updateCanvas(mockCanvasId, { title: 'New' })).rejects.toThrow('Update failed');
    });
  });

  describe('deleteCanvas', () => {
    it('should delete canvas and cascade delete elements', async () => {
      const mockFrom = vi.fn((table: string) => {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      await deleteCanvas(mockCanvasId);

      expect(mockFrom).toHaveBeenCalledWith('canvas_elements');
      expect(mockFrom).toHaveBeenCalledWith('canvas_documents');
    });

    it('should throw error if element deletion fails', async () => {
      const mockError = new Error('Delete failed');
      const mockFrom = vi.fn((table: string) => {
        if (table === 'canvas_elements') {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: mockError }),
            }),
          };
        }
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      await expect(deleteCanvas(mockCanvasId)).rejects.toThrow('Delete failed');
    });
  });

  describe('saveCanvasElement', () => {
    it('should insert new stroke element', async () => {
      const strokeElement: StrokeElement = {
        id: mockElementId,
        canvas_id: mockCanvasId,
        type: 'stroke',
        position: { x: 10, y: 20 },
        color: '#9c4a26',
        strokeWidth: 2,
        points: [
          { x: 10, y: 20 },
          { x: 15, y: 25 },
          { x: 20, y: 30 },
        ],
        tool: 'pen',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockDbRecord = {
        id: strokeElement.id,
        canvas_id: strokeElement.canvas_id,
        type: strokeElement.type,
        position: strokeElement.position,
        color: strokeElement.color,
        stroke_width: strokeElement.strokeWidth,
        element_data: {
          points: strokeElement.points,
          tool: strokeElement.tool,
        },
        created_at: strokeElement.created_at,
        updated_at: strokeElement.updated_at,
      };

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockDbRecord, error: null }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await saveCanvasElement(strokeElement);

      expect(result.type).toBe('stroke');
      expect(result.id).toBe(mockElementId);
    });

    it('should update existing element', async () => {
      const rectangleElement: RectangleElement = {
        id: mockElementId,
        canvas_id: mockCanvasId,
        type: 'rectangle',
        position: { x: 50, y: 50 },
        color: '#5a7a50',
        strokeWidth: 3,
        width: 100,
        height: 75,
        filled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockDbRecord = {
        id: rectangleElement.id,
        canvas_id: rectangleElement.canvas_id,
        type: rectangleElement.type,
        position: rectangleElement.position,
        color: rectangleElement.color,
        stroke_width: rectangleElement.strokeWidth,
        element_data: {
          width: rectangleElement.width,
          height: rectangleElement.height,
          filled: rectangleElement.filled,
        },
        created_at: rectangleElement.created_at,
        updated_at: rectangleElement.updated_at,
      };

      const mockFrom = vi.fn((table: string) => {
        if (table === 'canvas_elements') {
          const calls = mockFrom.mock.calls.length;
          if (calls === 1) {
            // First call - check if exists
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: mockElementId }, error: null }),
                }),
              }),
            };
          } else {
            // Second call - update
            return {
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: mockDbRecord, error: null }),
                  }),
                }),
              }),
            };
          }
        }
        return {};
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom as any);

      const result = await saveCanvasElement(rectangleElement);

      expect(result.type).toBe('rectangle');
      expect(result.id).toBe(mockElementId);
    });

    it('should save text element with correct data', async () => {
      const textElement: TextElement = {
        id: mockElementId,
        canvas_id: mockCanvasId,
        type: 'text',
        position: { x: 100, y: 100 },
        color: '#221f1c',
        strokeWidth: 1,
        content: 'Hello World',
        fontSize: 16,
        fontFamily: 'Inter',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockDbRecord = {
        id: textElement.id,
        canvas_id: textElement.canvas_id,
        type: textElement.type,
        position: textElement.position,
        color: textElement.color,
        stroke_width: textElement.strokeWidth,
        element_data: {
          content: textElement.content,
          fontSize: textElement.fontSize,
          fontFamily: textElement.fontFamily,
        },
        created_at: textElement.created_at,
        updated_at: textElement.updated_at,
      };

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockDbRecord, error: null }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await saveCanvasElement(textElement);

      expect(result.type).toBe('text');
      if (result.type === 'text') {
        expect(result.content).toBe('Hello World');
        expect(result.fontSize).toBe(16);
      }
    });
  });

  describe('loadCanvasElements', () => {
    it('should load all elements for a canvas ordered by creation time', async () => {
      const mockDbRecords = [
        {
          id: 'elem-1',
          canvas_id: mockCanvasId,
          type: 'stroke',
          position: { x: 10, y: 20 },
          color: '#9c4a26',
          stroke_width: 2,
          element_data: {
            points: [{ x: 10, y: 20 }, { x: 15, y: 25 }],
            tool: 'pen',
          },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'elem-2',
          canvas_id: mockCanvasId,
          type: 'rectangle',
          position: { x: 50, y: 50 },
          color: '#5a7a50',
          stroke_width: 3,
          element_data: {
            width: 100,
            height: 75,
            filled: false,
          },
          created_at: '2024-01-01T00:01:00Z',
          updated_at: '2024-01-01T00:01:00Z',
        },
      ];

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockDbRecords, error: null }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await loadCanvasElements(mockCanvasId);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('stroke');
      expect(result[1].type).toBe('rectangle');
    });

    it('should return empty array if no elements exist', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      const result = await loadCanvasElements(mockCanvasId);

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockError = new Error('Load failed');
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: mockError }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      await expect(loadCanvasElements(mockCanvasId)).rejects.toThrow('Load failed');
    });
  });

  describe('deleteCanvasElement', () => {
    it('should delete canvas element by id', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      await deleteCanvasElement(mockElementId);

      expect(mockFrom).toHaveBeenCalledWith('canvas_elements');
    });

    it('should throw error on database failure', async () => {
      const mockError = new Error('Delete failed');
      const mockFrom = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: mockError }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockFrom);

      await expect(deleteCanvasElement(mockElementId)).rejects.toThrow('Delete failed');
    });
  });
});
