// Add this test: src/test/canvas-id-uniqueness.test.ts
import fc from 'fast-check';
import { createCanvasId } from '@/lib/canvas';

describe('Property: Element ID Uniqueness', () => {
  test('should generate unique IDs for canvas elements', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 1000 }),
      (count) => {
        // Generate unique IDs
        const ids = new Set<string>();
        for (let i = 0; i < count; i++) {
          const id = createCanvasId();
          ids.add(id);
        }
        
        // Verify all IDs are unique
        return ids.size === count;
      }
    ), { numRuns: 100 });
  });
});