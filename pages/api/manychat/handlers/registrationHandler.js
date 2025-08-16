import {
  updateUser,
  isUsernameAvailable,
  isUserRegistrationComplete
} from '../services/userService.js';
import { validateUsername, validateGrade } from '../utils/validators.js';
import { CONSTANTS, MESSAGES } from '../config/constants.js';
import { executeQuery } from '../config/database.js';

export async function handleRegistration(user, message) {
  const registrationState = determineRegistrationState(user);

  switch (registrationState) {
    case CONSTANTS.REGISTRATION_STATES.NEEDS_USERNAME:
      return await handleUsernameRegistration(user, message);

    case CONSTANTS.REGISTRATION_STATES.NEEDS_GRADE:
      return await handleGradeRegistration(user, message);

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
    // REMOVED: No longer need subjects for Panic + Therapy pivot
    return CONSTANTS.REGISTRATION_STATES.COMPLETE;
  } catch {
    return CONSTANTS.REGISTRATION_STATES.NEEDS_USERNAME;
  }
}

async function handleUsernameRegistration(user, message) {
  const trimmed = message.trim();

  if (!user.display_name) {
    // First step: get display name
    await updateUser(user.id, {
      display_name: trimmed,
      last_active_at: new Date().toISOString()
    });

    return {
      reply: MESSAGES.REGISTRATION.USERNAME_PROMPT,
      shouldContinue: false
    };
  }

  // Second step: get username
  const validation = validateUsername(trimmed);

  if (!validation.isValid) {
    return {
      reply: `${validation.error} 📚\n\n${validation.suggestion ? `💡 Try: ${validation.suggestion}` : ''}`,
      shouldContinue: false
    };
  }

  const isAvailable = await isUsernameAvailable(validation.username);
  if (!isAvailable) {
    return {
      reply: `Username "${validation.username}" is taken! 😅\n\nTry adding numbers or underscores: ${validation.username}123, ${validation.username}_za\n\nPick another username! 🎯`,
      shouldContinue: false
    };
  }

  await updateUser(user.id, {
    username: validation.username,
    last_active_at: new Date().toISOString()
  });

  return {
    reply: `Sharp! Username @${validation.username} is yours! 🔥\n\n${MESSAGES.REGISTRATION.GRADE_PROMPT}`,
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

  // PIVOT: Auto-set to math-only and complete registration
  await updateUser(user.id, {
    grade: validation.grade,
    preferred_subjects: ['math'], // AUTO-SET: Math only for Panic + Therapy
    current_menu: 'main',
    last_active_at: new Date().toISOString()
  });

  const gradeDisplay = validation.grade === 'varsity' ? 'University' : `Grade ${validation.grade}`;

  // PIVOT: New welcome message for Panic + Therapy platform
  const welcomeMessage =
    `🎉 **WELCOME TO THE GOAT!** 🐐\n\n` +
    `${gradeDisplay} Maths support is ready!\n\n` +
    `🚨 **When you're stressed:** Type "panic" for emergency help\n` +
    `🧠 **When you doubt yourself:** Type "therapy" for confidence boost\n` +
    `🎯 **For practice:** Type "next" for questions\n\n` +
    `**Ready to dominate maths? Let's go!** 💪\n\n` +
    `Type "help" to see all commands or "next" to start! 🚀`;

  return {
    reply: welcomeMessage,
    shouldContinue: false
  };
}

export function getWelcomeMessage() {
  return (
    `🎉 **WELCOME TO THE GOAT!** 🐐\n\n` +
    `Your personal Maths confidence companion!\n\n` +
    `🔥 **What we do:**\n` +
    `• 🚨 **Panic Mode**: Emergency help when you're stressed\n` +
    `• 🧠 **Therapy Mode**: Build your academic confidence\n` +
    `• 🎯 **Practice**: Sharpen your maths skills\n\n` +
    `Let's get you set up! First, what should I call you?\n\n` +
    `💡 **Examples:** Alex, Sarah, Thabo, or your real name\n\n` +
    `Type your name to continue! ✨`
  );
}

export function getUserRegistrationState(user) {
  return determineRegistrationState(user);
}
