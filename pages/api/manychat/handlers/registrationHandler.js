import {
  updateUser,
  isUsernameAvailable,
  getUserRegistrationState
} from '../services/userService.js';
import { validateUsername, validateGrade, validateSubjects } from '../utils/validators.js';
import { CONSTANTS, MESSAGES } from '../config/constants.js';

export async function handleRegistration(user, message) {
  const registrationState = await getUserRegistrationState(user);

  switch (registrationState) {
    case CONSTANTS.REGISTRATION_STATES.NEEDS_USERNAME:
      return await handleUsernameRegistration(user, message);

    case CONSTANTS.REGISTRATION_STATES.NEEDS_GRADE:
      return await handleGradeRegistration(user, message);

    case CONSTANTS.REGISTRATION_STATES.NEEDS_SUBJECTS:
      return await handleSubjectsRegistration(user, message);

    case CONSTANTS.REGISTRATION_STATES.COMPLETE:
      return null; // Continue with normal flow

    default:
      throw new Error('Unknown registration state');
  }
}

async function handleUsernameRegistration(user, message) {
  // First time user - show welcome message
  if (!user.display_name) {
    await updateUser(user.id, {
      display_name: message.trim() || `User ${user.id}`,
      last_active_at: new Date().toISOString()
    });

    return {
      reply: MESSAGES.REGISTRATION.USERNAME_PROMPT,
      shouldContinue: false
    };
  }

  // User is providing username
  const validation = validateUsername(message);

  if (!validation.isValid) {
    return {
      reply: `Eish, ${validation.error}. Try something sharp like ${validation.suggestion}? 🎯`,
      shouldContinue: false
    };
  }

  // Check if username is available
  const isAvailable = await isUsernameAvailable(validation.username);

  if (!isAvailable) {
    return {
      reply: `Username @${validation.username} is taken! Try something sharp like ${validation.username}${Math.floor(Math.random() * 99)}? 🎯`,
      shouldContinue: false
    };
  }

  // ✅ FIXED: Remove friend code completely
  await updateUser(user.id, {
    username: validation.username,
    last_active_at: new Date().toISOString()
  });

  // ✅ FIXED: Username-only confirmation message
  return {
    reply:
      `Sharp! You're now @${validation.username} 🔥\n\n` +
      `Friends can find you by searching: @${validation.username}\n\n` +
      `${MESSAGES.REGISTRATION.GRADE_PROMPT}`,
    shouldContinue: false
  };
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

  const gradeDisplay = validation.grade === 'varsity' ? 'Varsity' : `Grade ${validation.grade}`;

  return {
    reply: `Perfect! ${gradeDisplay} student 🎓\n\n${MESSAGES.REGISTRATION.SUBJECTS_PROMPT}`,
    shouldContinue: false
  };
}

async function handleSubjectsRegistration(user, message) {
  const validation = validateSubjects(message);

  if (!validation.isValid) {
    return {
      reply: `${validation.error}\n${validation.example || ''} 📝`,
      shouldContinue: false
    };
  }

  // Set proper menu state
  await updateUser(user.id, {
    preferred_subjects: validation.subjects,
    current_menu: CONSTANTS.MENU_TYPES.MAIN,
    registration_completed_at: new Date().toISOString(),
    last_active_at: new Date().toISOString()
  });

  const subjectsList = validation.subjects
    .map((s) => CONSTANTS.SUBJECT_DISPLAY_NAMES[s] || s)
    .join(', ');

  return {
    reply: generateWelcomeCompleteMessage(user.username, subjectsList),
    shouldContinue: false
  };
}

// ✅ FIXED: Remove friend code references
function generateWelcomeCompleteMessage(username, subjectsList) {
  return (
    `🎉 **REGISTRATION COMPLETE!**\n\n` +
    `Welcome to The GOAT, @${username}! 🐐\n\n` +
    `🎯 **Your subjects:** ${subjectsList}\n\n` +
    `You're all set to dominate! Here's what you can do:\n\n` +
    `🏠 **MAIN MENU:**\n` +
    `1️⃣ ${CONSTANTS.MAIN_MENU_OPTIONS[1].emoji} ${CONSTANTS.MAIN_MENU_OPTIONS[1].description}\n` +
    `2️⃣ ${CONSTANTS.MAIN_MENU_OPTIONS[2].emoji} ${CONSTANTS.MAIN_MENU_OPTIONS[2].description} (Math has 8 topics!)\n` +
    `3️⃣ ${CONSTANTS.MAIN_MENU_OPTIONS[3].emoji} ${CONSTANTS.MAIN_MENU_OPTIONS[3].description}\n` +
    `4️⃣ ${CONSTANTS.MAIN_MENU_OPTIONS[4].emoji} ${CONSTANTS.MAIN_MENU_OPTIONS[4].description}\n` +
    `5️⃣ ${CONSTANTS.MAIN_MENU_OPTIONS[5].emoji} ${CONSTANTS.MAIN_MENU_OPTIONS[5].description}\n\n` +
    `💡 **Adding friends:** They can find you by searching @${username}\n\n` +
    `Ready to start? Type the number! 🔥`
  );
}

export function getWelcomeMessage() {
  return MESSAGES.REGISTRATION.WELCOME;
}
