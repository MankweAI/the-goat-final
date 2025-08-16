import {
  updateUser,
  isUsernameAvailable,
  isUserRegistrationComplete
} from '../services/userService.js';
import { validateUsername, validateGrade } from '../utils/validators.js';
import { CONSTANTS, MESSAGES } from '../config/constants.js';
import { questionService } from '../services/questionService.js';
import { formatQuestion } from '../utils/questionFormatter.js';
import { executeQuery } from '../config/database.js';

export async function handleRegistration(user, message) {
  // (unchanged logging)...

  const registrationState = determineRegistrationState(user);

  switch (registrationState) {
    case CONSTANTS.REGISTRATION_STATES.NEEDS_USERNAME:
      return await handleUsernameRegistration(user, message);

    case CONSTANTS.REGISTRATION_STATES.NEEDS_GRADE:
      return await handleGradeRegistration(user, message);

    case CONSTANTS.REGISTRATION_STATES.NEEDS_SUBJECTS:
      return await handleSubjectsRegistration(user, message);

    case CONSTANTS.REGISTRATION_STATES.COMPLETE:
      return null;

    default:
      return {
        reply: `Let's get you set up! What should I call you? 🎯`,
        shouldContinue: false
      };
  }
}

function determineRegistrationState(user) {
  try {
    if (!user.display_name) return CONSTANTS.REGISTRATION_STATES.NEEDS_USERNAME;
    if (!user.username) return CONSTANTS.REGISTRATION_STATES.NEEDS_USERNAME;
    if (!user.grade) return CONSTANTS.REGISTRATION_STATES.NEEDS_GRADE;
    if (!user.preferred_subjects || user.preferred_subjects.length === 0) {
      return CONSTANTS.REGISTRATION_STATES.NEEDS_SUBJECTS;
    }
    return CONSTANTS.REGISTRATION_STATES.COMPLETE;
  } catch {
    return CONSTANTS.REGISTRATION_STATES.NEEDS_USERNAME;
  }
}

async function handleUsernameRegistration(user, message) {
  // (unchanged, reusing MESSAGES prompts) ...
}

async function handleGradeRegistration(user, message) {
  const validation = validateGrade(message);

  if (!validation.isValid) {
    return {
      reply: `${validation.error} 📚`,
      shouldContinue: false
    };
  }

  await updateUser(user.id, {
    grade: validation.grade,
    last_active_at: new Date().toISOString()
  });

  const gradeDisplay = `Grade ${validation.grade}`;

  return {
    reply: `Perfect! ${gradeDisplay} student 🎓\n\n${MESSAGES.REGISTRATION.SUBJECTS_PROMPT}`,
    shouldContinue: false
  };
}

// handleSubjectsRegistration unchanged (uses existing helpers)...

export function getWelcomeMessage() {
  return MESSAGES.REGISTRATION.WELCOME;
}

export function getUserRegistrationState(user) {
  return determineRegistrationState(user);
}
