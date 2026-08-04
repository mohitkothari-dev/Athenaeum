// Add this test: src/test/canvas-id-uniqueness.test.ts
import fc from 'fast-check';
// Generate unique IDs using browser's crypto API instead of uuid module for native support
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

describe('Property: Element ID Uniqueness', () => {
  test('should generate unique IDs for canvas elements', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 1000 }),
      (count) => {
        // Generate unique IDs
        const ids = new Set<string>();
        for (let i = 0; i < count; i++) {
          const id = uuidv4();
          ids.add(id);
        }
        
        // Verify all IDs are unique
        return ids.size === count;
      }
    ), { numRuns: 100 });
  });
});