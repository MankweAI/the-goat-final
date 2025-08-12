import { env } from './config';

export function clamp(n, min = 0, max = 1) {
  return Math.min(max, Math.max(min, n));
}

export function updateRate(oldRate, isCorrect) {
  const next = env.EMA_ALPHA * (isCorrect ? 1 : 0) + (1 - env.EMA_ALPHA) * oldRate;
  return Math.round(clamp(next) * 1000) / 1000;
}

export function selectDifficulty(rate, previous) {
  let target;
  if (rate < env.DIFF_EASY_MAX) target = 'easy';
  else if (rate <= env.DIFF_MED_MAX) target = 'medium';
  else target = 'hard';

  if (previous && previous !== target) {
    // Hysteresis enforcement
    if (previous === 'easy' && rate < env.DIFF_EASY_MAX + env.DIFF_HYSTERESIS) target = 'easy';
    if (previous === 'hard' && rate > env.DIFF_MED_MAX - env.DIFF_HYSTERESIS) target = 'hard';
    if (previous === 'medium') {
      if (rate >= env.DIFF_EASY_MAX - env.DIFF_HYSTERESIS && rate <= env.DIFF_MED_MAX + env.DIFF_HYSTERESIS) {
        target = 'medium';
      }
    }
  }
  return target;
}
