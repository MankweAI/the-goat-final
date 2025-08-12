import { updateRate, selectDifficulty } from '../../lib/difficulty.js';

describe('difficulty helpers', () => {
  test('updateRate moves toward 1 on correct', () => {
    const r = updateRate(0.5, true);
    expect(r).toBeGreaterThan(0.5);
  });
  test('updateRate moves toward 0 on incorrect', () => {
    const r = updateRate(0.5, false);
    expect(r).toBeLessThan(0.5);
  });
  test('selectDifficulty basic bands', () => {
    expect(selectDifficulty(0.2, null)).toBe('easy');
    expect(selectDifficulty(0.5, null)).toBe('medium');
    expect(selectDifficulty(0.9, null)).toBe('hard');
  });
});
