import { normalizeTopic } from '../../lib/topic.js';

describe('topic normalization', () => {
  test('exact match', () => {
    expect(normalizeTopic('algebra')).toBe('algebra');
  });
  test('alias match', () => {
    expect(normalizeTopic('alg')).toBe('algebra');
  });
  test('unknown', () => {
    expect(normalizeTopic('history')).toBeNull();
  });
});
