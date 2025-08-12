export const TOPIC_ALIASES = {
  algebra: ['algebra', 'alg'],
  trig: ['trig', 'trigonometry'],
  geometry: ['geometry', 'geo']
};

export function normalizeTopic(input) {
  if (!input) return null;
  const cleaned = input.trim().toLowerCase();
  for (const canonical of Object.keys(TOPIC_ALIASES)) {
    if (canonical === cleaned) return canonical;
    if (TOPIC_ALIASES[canonical].includes(cleaned)) return canonical;
  }
  return null;
}
