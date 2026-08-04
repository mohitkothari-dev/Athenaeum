import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('Testing Setup Verification', () => {
  it('vitest should work correctly', () => {
    expect(1 + 1).toBe(2);
  });

  it('fast-check should be available', () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        return n === n;
      })
    );
  });
});
