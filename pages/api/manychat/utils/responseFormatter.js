import { CONSTANTS } from '../config/constants.js';

export function formatResponse(reply, metadata = {}) {
  return {
    status: 'success',
    echo:
      reply.length > CONSTANTS.MAX_RESPONSE_LENGTH
        ? reply.substring(0, CONSTANTS.MAX_RESPONSE_LENGTH - 3) + '...'
        : reply,
    elapsed_ms: metadata.elapsed_ms || 0,
    subscriber_id: metadata.subscriber_id,
    processed_at: new Date().toISOString(),
    ...metadata
  };
}

export function formatErrorResponse(error, metadata = {}) {
  console.error('Error response:', error);

  return {
    status: 'error',
    echo: typeof error === 'string' ? error : CONSTANTS.MESSAGES.ERRORS.GENERIC,
    error: error.message || error,
    elapsed_ms: metadata.elapsed_ms || 0,
    processed_at: new Date().toISOString(),
    ...metadata
  };
}

export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function formatStreak(streak) {
  if (streak >= CONSTANTS.STREAK_LEVELS.TRIPLE_FIRE) return '🔥🔥🔥';
  if (streak >= CONSTANTS.STREAK_LEVELS.DOUBLE_FIRE) return '🔥🔥';
  if (streak >= CONSTANTS.STREAK_LEVELS.FIRE) return '🔥';
  return '';
}

export function formatSubjectsList(subjects) {
  return subjects.map((s) => CONSTANTS.SUBJECT_DISPLAY_NAMES[s] || capitalize(s)).join(', ');
}

