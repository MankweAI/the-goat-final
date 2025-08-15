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

  // Generate friend code and update user
  const friendCode = await generateFriendCode();

  await updateUser(user.id, {
    username: validation.username,
    friend_code: friendCode,
    last_active_at: new Date().toISOString()
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

// ✅ UPDATED: Enhanced final registration step with numbered menu
async function handleSubjectsRegistration(user, message) {
  const validation = validateSubjects(message);

  if (!validation.isValid) {
    return {
      reply: `${validation.error}\n${validation.example || ''} 📝`,
      shouldContinue: false
    };
  }

  // ✅ ENHANCED: Set initial menu state and complete registration
  await updateUser(user.id, {
    preferred_subjects: validation.subjects,
    current_menu: 'main', // Set initial menu state
    registration_completed_at: new Date().toISOString(),
    last_active_at: new Date().toISOString()
  });

  const subjectsList = validation.subjects
    .map((s) => CONSTANTS.SUBJECT_DISPLAY_NAMES[s] || s)
    .join(', ');

  // ✅ ENHANCED: Updated welcome message with numbered menu system
  return {
    reply: generateWelcomeCompleteMessage(user.username, subjectsList),
    shouldContinue: false
  };
}

// ✅ NEW: Generate enhanced welcome completion message
function generateWelcomeCompleteMessage(username, subjectsList) {
  return (
    `🎉 **REGISTRATION COMPLETE!**\n\n` +
    `Welcome to The GOAT, @${username}! 🐐\n\n` +
    `🎯 **Your subjects:** ${subjectsList}\n\n` +
    `You're all set to dominate! Here's what you can do:\n\n` +
    `🏠 **MAIN MENU:**\n` +
    `1️⃣ Get practice question\n` +
    `2️⃣ Choose subjects (Math has 8 topics!)\n` +
    `3️⃣ See your progress\n` +
    `4️⃣ Friends & challenges\n` +
    `5️⃣ Settings\n\n` +
    `⚡ **Quick tip:** Math has sub-topics like Algebra, Trigonometry, Calculus, and more!\n\n` +
    `Ready to start? Type the number! 🔥`
  );
}

// ✅ ENHANCED: Updated welcome message for consistency
export function getWelcomeMessage() {
  return (
    `🎉 **WELCOME TO THE GOAT!** 🐐\n\n` +
    `The ultimate South African learning bot that'll make you sharp at maths, science, and more!\n\n` +
    `🔥 **What makes us special:**\n` +
    `• Adaptive questions that match your level\n` +
    `• Track your progress and streaks\n` +
    `• Challenge friends and climb leaderboards\n` +
    `• Master topics step-by-step\n\n` +
    `Let's get you set up! First, what should I call you?\n\n` +
    `💡 **Examples:** Alex, Sarah, Thabo, or your real name\n\n` +
    `Type your name to continue! ✨`
  );
}

// ✅ NEW: Quick registration status check for debugging
export function getRegistrationDebugInfo(user) {
  const state = {
    hasDisplayName: !!user.display_name,
    hasUsername: !!user.username,
    hasGrade: !!user.grade,
    hasSubjects: !!user.preferred_subjects?.length,
    currentMenu: user.current_menu || 'none',
    registrationComplete: !!user.registration_completed_at
  };

  return (
    `🐛 **REGISTRATION DEBUG:**\n` +
    `• Display name: ${state.hasDisplayName ? '✅' : '❌'}\n` +
    `• Username: ${state.hasUsername ? '✅' : '❌'}\n` +
    `• Grade: ${state.hasGrade ? '✅' : '❌'}\n` +
    `• Subjects: ${state.hasSubjects ? '✅' : '❌'}\n` +
    `• Menu: ${state.currentMenu}\n` +
    `• Complete: ${state.registrationComplete ? '✅' : '❌'}`
  );
}

// ✅ NEW: Helper to transition from registration to main flow
export async function completeRegistrationTransition(user) {
  try {
    await updateUser(user.id, {
      current_menu: 'main',
      last_active_at: new Date().toISOString()
    });

    console.log(`✅ Registration transition complete for user ${user.id}`);
    return true;
  } catch (error) {
    console.error(`❌ Registration transition failed for user ${user.id}:`, error);
    return false;
  }
}
