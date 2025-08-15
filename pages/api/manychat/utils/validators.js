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
      error: 'Invalid grade. Choose from: 8, 9, 10, 11, 12, or varsity'
    };
  }

  return { isValid: true, grade: normalized };
}



