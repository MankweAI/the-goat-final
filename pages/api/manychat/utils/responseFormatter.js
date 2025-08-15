/**
 * Enhanced Response Formatter for Post-Answer Experience
 * Handles response packaging, error formatting, and various text/emoji formatting utilities.
 */

import { CONSTANTS } from '../config/constants.js';

/**
 * Formats a successful response payload for the webhook.
 * Truncates long messages to prevent errors.
 * @param {string} reply - The text message to send to the user.
 * @param {object} metadata - Additional metadata for the response.
 * @returns {object} The final JSON payload.
 */
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

/**
 * Formats an error response payload.
 * @param {Error|string} error - The error object or message.
 * @param {object} metadata - Additional metadata for the response.
 * @returns {object} The final JSON payload for an error.
 */
export function formatErrorResponse(error, metadata = {}) {
  console.error('Error response:', error);

  return {
    status: 'error',
    echo: typeof error === 'string' ? error : CONSTANTS.MESSAGES.ERRORS.GENERIC,
    error: error.message || String(error),
    elapsed_ms: metadata.elapsed_ms || 0,
    processed_at: new Date().toISOString(),
    ...metadata
  };
}

/**
 * Capitalizes the first letter of a string.
 * @param {string} str - The input string.
 * @returns {string} The capitalized string.
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Formats a list of subject names for display.
 * @param {string[]} subjects - An array of subject names.
 * @returns {string} A formatted, comma-separated string.
 */
export function formatSubjectsList(subjects) {
  return subjects.map((s) => CONSTANTS.SUBJECT_DISPLAY_NAMES[s] || capitalize(s)).join(', ');
}

// ============================================================================
// NEW AND UPDATED FORMATTING FUNCTIONS
// ============================================================================

/**
 * Format streak with context-appropriate emojis.
 * @param {number} streak - The user's current streak count.
 * @returns {string} A string of emojis representing the streak.
 */
export function formatStreak(streak) {
  if (streak >= 20) return '🔥🔥🔥🏆';
  if (streak >= 15) return '🔥🔥🔥';
  if (streak >= 10) return '🔥🔥⚡';
  if (streak >= 5) return '🔥🔥';
  if (streak >= 3) return '🔥';
  if (streak >= 1) return '⭐';
  return '';
}

/**
 * Format percentage with appropriate precision.
 * Returns a special emoji for 100%.
 * @param {number} value - The percentage value (e.g., 85.7).
 * @returns {string|number} The formatted percentage string or number.
 */
export function formatPercentage(value) {
  if (value >= 99.5) return '💯';
  return Math.round(value);
}

/**
 * Format topic name for display (e.g., 'number_theory' -> 'Number Theory').
 * @param {string} topicName - The topic name from the database.
 * @returns {string} The formatted topic name.
 */
export function formatTopicName(topicName) {
  if (!topicName) return 'this topic';

  const formatted = topicName
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return formatted;
}

/**
 * Format difficulty indicator with emojis.
 * @param {string} difficulty - The difficulty level ('easy', 'medium', 'hard').
 * @returns {string} The formatted difficulty string.
 */
export function formatDifficulty(difficulty) {
  const indicators = {
    easy: '🟢 Easy',
    medium: '🟡 Medium',
    hard: '🔴 Hard',
    expert: '🟣 Expert'
  };

  return indicators[difficulty] || '🟡 Medium';
}

/**
 * Format time-based greeting.
 * @returns {string} A greeting appropriate for the current time of day.
 */
export function formatTimeGreeting() {
  const hour = new Date().getHours();

  if (hour < 6) return 'Late night learning! 🌙';
  if (hour < 12) return 'Morning grind! ☀️';
  if (hour < 17) return 'Afternoon hustle! 🌤️';
  if (hour < 21) return 'Evening focus! 🌅';
  return 'Night owl mode! 🦉';
}

/**
 * Format motivational message based on performance.
 * @param {number} accuracy - The user's accuracy percentage.
 * @param {number} streak - The user's current streak.
 * @returns {string} A motivational message.
 */
export function formatMotivation(accuracy, streak) {
  if (accuracy >= 90 && streak >= 10) {
    return "You're absolutely unstoppable! 🚀";
  }
  if (accuracy >= 80 && streak >= 5) {
    return 'Crushing it! Keep this momentum! 💪';
  }
  if (accuracy >= 70 && streak >= 3) {
    return 'Building strong foundations! 📈';
  }
  if (accuracy >= 60) {
    return 'Making steady progress! 🎯';
  }
  return 'Every question makes you stronger! 💪';
}

/**
 * Format subject emoji.
 * @param {string} subject - The subject name.
 * @returns {string} An emoji for the subject.
 */
export function formatSubjectEmoji(subject) {
  const emojis = {
    math: '🧮',
    mathematics: '🧮',
    physics: '⚡',
    chemistry: '⚗️',
    life_sciences: '🧬',
    biology: '🧬',
    english: '📖',
    geography: '🌍',
    history: '📜'
  };

  return emojis[subject?.toLowerCase()] || '📚';
}
