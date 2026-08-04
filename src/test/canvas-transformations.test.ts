// Add this test file: src/test/canvas-transformations.test.ts
import fc from 'fast-check';
import type { ViewportTransform, Point } from '@/types/canvas';

describe('Property: Viewport Transformation Consistency', () => {
  // Property 2: Viewport Transformation Consistency
  // Validates: Requirements 10.5
  // Test that screen → canvas → screen yields original coordinates within 0.01 pixel tolerance
  
  test('screenToCanvas then canvasToScreen should return original screen coordinates', () => {
    fc.assert(fc.property(
      // Generate random viewport states
      fc.record({
        x: fc.integer({ min: -1000, max: 1000 }),
        y: fc.integer({ min: -1000, max: 1000 }),
        scale: fc.float({ min: Math.fround(0.1), max: Math.fround(5.0), noNaN: true })
      }),
      // Generate random screen coordinates
      fc.record({
        screenX: fc.integer({ min: -2000, max: 2000 }),
        screenY: fc.integer({ min: -2000, max: 2000 })
      }),
      (viewport, screenCoords) => {
        // Import the transformation functions
        const { screenToCanvas, canvasToScreen } = require('@/hooks/useCanvasEngine');
        
        // Apply transformations
        const canvasPoint: Point = screenToCanvas(screenCoords.screenX, screenCoords.screenY);
        const resultScreenCoords: Point = canvasToScreen(canvasPoint.x, canvasPoint.y);
        
        // Verify the transformation is consistent within tolerance
        const tolerance = 0.01;
        const xMatch = Math.abs(resultScreenCoords.x - screenCoords.screenX) <= tolerance;
        const yMatch = Math.abs(resultScreenCoords.y - screenCoords.screenY) <= tolerance;
        
        return xMatch && yMatch;
      }
    ), { numRuns: 100 });
  });
});