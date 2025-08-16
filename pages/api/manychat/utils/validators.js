import { CONSTANTS } from '../config/constants.js';

export function validateUsername(username) {
  const cleaned = username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');

  if (cleaned.length < 3 || cleaned.length > 20) {
    return {
      isValid: false,
      error: 'Username must be 3-20 characters (letters, numbers, underscore only)',
      suggestion: `Try something like ${cleaned}${Math.floor(Math.random() * 99)}`
    };
  }

  return { isValid: true, username: cleaned };
}

export function validateGrade(grade) {
  const normalized = grade.trim().toLowerCase();

  if (!CONSTANTS.VALID_GRADES.includes(normalized)) {
    return {
      isValid: false,
      error: 'Invalid grade. MVP supports Grade 10 or 11'
    };
  }

  return { isValid: true, grade: normalized };
}
