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

export function validateSubjects(subjectsInput) {
  const subjects = subjectsInput
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const validSubjects = subjects.filter((s) => CONSTANTS.VALID_SUBJECTS.includes(s));

  if (validSubjects.length === 0) {
    return {
      isValid: false,
      error: 'Please choose from: math, physics, life sciences, chemistry',
      example: 'Example: math, physics'
    };
  }

  return { isValid: true, subjects: validSubjects };
}

export function validateFriendCode(friendCode) {
  const cleaned = friendCode.trim().toUpperCase();

  if (!/^GOAT[A-Z0-9]{4}$/.test(cleaned)) {
    return {
      isValid: false,
      error: 'Friend code should be in format: GOAT1234'
    };
  }

  return { isValid: true, friendCode: cleaned };
}

