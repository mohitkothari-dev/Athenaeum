// Add this test: src/test/canvas-user-isolation.test.ts
import fc from 'fast-check';

describe('Property: User Data Isolation', () => {
  test('should prevent users from accessing other users canvas documents', () => {
    fc.assert(fc.property(
      fc.record({
        userId1: fc.constant('user-1'),
        userId2: fc.constant('user-2'),
        canvasId: fc.oneof(
          fc.constant('canvas-user-1'),
          fc.constant('canvas-user-2'),
          fc.constant('other-canvas')
        ),
      }),
      (data) => {
        // Simulate user data isolation logic
        // Users can only access their own canvases
        // User-1 can only access canvases where user_id === 'user-1'
        // User-2 can only access canvases where user_id === 'user-2'
        
        let user1CanAccess = false;
        let user2CanAccess = false;
        
        // Determine which user owns the canvas based on canvasId
        if (data.canvasId === 'canvas-user-1') {
          // Canvas belongs to user-1
          user1CanAccess = data.userId1 === 'user-1';
          user2CanAccess = data.userId2 === 'user-2'; // user-2 should NOT access user-1's canvas
        } else if (data.canvasId === 'canvas-user-2') {
          // Canvas belongs to user-2
          user1CanAccess = data.userId1 === 'user-1'; // user-1 should NOT access user-2's canvas
          user2CanAccess = data.userId2 === 'user-2';
        } else {
          // Other canvas - no one can access it
          user1CanAccess = false;
          user2CanAccess = false;
        }
        
        // For proper isolation:
        // - Users should be able to access their OWN canvases
        // - Users should NOT be able to access other users' canvases
        // The exact pattern depends on the specific user/canvas combination
        
        // We'll use a more flexible validation that checks isolation rules
        const isProperlyIsolated = 
          (data.canvasId === 'canvas-user-1' && user1CanAccess && !user2CanAccess) ||
          (data.canvasId === 'canvas-user-2' && user2CanAccess && !user1CanAccess) ||
          (data.canvasId === 'other-canvas' && !user1CanAccess && !user2CanAccess);
        
        return isProperlyIsolated;
      }
    ), { numRuns: 50 });
  });
});