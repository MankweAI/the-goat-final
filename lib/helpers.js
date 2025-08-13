// Helper functions for The GOAT webhook
// Date: 2025-08-13 09:49:53 UTC

export function calculateUserDifficulty(correctAnswerRate, totalQuestions) {
  // Need at least 5 questions for reliable difficulty assessment
  if (totalQuestions < 5) {
    return 'medium';
  }

  if (correctAnswerRate >= 0.75) {
    return 'hard';
  } else if (correctAnswerRate >= 0.55) {
    return 'medium';
  } else {
    return 'easy';
  }
}

export function isValidTimeInput(input) {
  const hour = parseInt(input);
  return !isNaN(hour) && hour >= 0 && hour <= 23;
}

export function formatTimeDisplay(hour) {
  if (hour === 0) return '12 AM (midnight)';
  if (hour === 12) return '12 PM (noon)';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

export function calculateStreakMultiplier(streak) {
  if (streak >= 10) return 1.5;
  if (streak >= 5) return 1.2;
  if (streak >= 3) return 1.1;
  return 1.0;
}

export function getEngagementLevel(totalQuestions, streak, correctRate) {
  let score = 0;

  // Questions volume (max 30 points)
  score += Math.min(totalQuestions * 2, 30);

  // Streak bonus (max 25 points)
  score += Math.min(streak * 2, 25);

  // Accuracy bonus (max 45 points)
  score += correctRate * 45;

  if (score >= 80) return 'Expert';
  if (score >= 60) return 'Advanced';
  if (score >= 40) return 'Intermediate';
  if (score >= 20) return 'Beginner';
  return 'New';
}
