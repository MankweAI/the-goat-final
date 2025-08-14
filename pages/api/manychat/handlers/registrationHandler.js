import {
  updateUser,
  generateFriendCode,
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
      display_name: message.trim() || `User ${user.id}`
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

  // Generate friend code and update user
  const friendCode = await generateFriendCode();

  await updateUser(user.id, {
    username: validation.username,
    friend_code: friendCode
  });

  return {
    reply: `Sharp! You're now @${validation.username} 🔥\n\nYour friend code: **${friendCode}**\nShare this with friends to connect!\n\n${MESSAGES.REGISTRATION.GRADE_PROMPT}`,
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

  await updateUser(user.id, { grade: validation.grade });

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

  await updateUser(user.id, {
    preferred_subjects: validation.subjects
  });

  const subjectsList = validation.subjects
    .map((s) => CONSTANTS.SUBJECT_DISPLAY_NAMES[s] || s)
    .join(', ');

  return {
    reply: `Lekker! Ready to dominate ${subjectsList}! 💪\n\nYou're all set! Here's what you can do:\n\n🎯 Type "next" for a question\n👥 Type "add friend [code]" to connect\n📊 Type "report" for your stats\n🔄 Type "switch to [subject]" anytime\n💬 Type "help" for more commands\n\nLet's get started! Type "next" for your first question 🔥`,
    shouldContinue: false
  };
}

export function getWelcomeMessage() {
  return MESSAGES.REGISTRATION.WELCOME;
}

