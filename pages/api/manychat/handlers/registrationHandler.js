import {
  updateUser,
  isUsernameAvailable,
  getUserRegistrationState
} from '../services/userService.js';
import { validateUsername, validateGrade } from '../utils/validators.js';
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

  await updateUser(user.id, {
    username: validation.username,
    last_active_at: new Date().toISOString()
  });

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

// ✅ COMPLETELY REWRITTEN: Now uses numbered input instead of text
async function handleSubjectsRegistration(user, message) {
  const validation = validateSubjectsFromNumbers(message);

  if (!validation.isValid) {
    return {
      reply: `${validation.error}\n\n${MESSAGES.REGISTRATION.SUBJECTS_PROMPT}`,
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

// ✅ NEW: Validate subjects from numbered input
// ✅ FIX: Define subject display names locally to avoid CONSTANTS dependency
function validateSubjectsFromNumbers(input) {
  try {
    const trimmed = input.trim();

    // Extract numbers from input (support various formats)
    const numberMatches = trimmed.match(/\d+/g);

    if (!numberMatches || numberMatches.length === 0) {
      return {
        isValid: false,
        error:
          `Please use numbers to select subjects! 🔢\n\n` +
          `Example: Type "1,3" for Math and Life Sciences\n` +
          `Or: "1 3" or "1, 3" - any format works!`
      };
    }

    // Convert to unique numbers and filter valid ones (1-4)
    const numbers = [...new Set(numberMatches.map((n) => parseInt(n)))]
      .filter((n) => n >= 1 && n <= 4)
      .sort();

    if (numbers.length === 0) {
      return {
        isValid: false,
        error:
          `Valid subject numbers are 1-4 only! 📚\n\n` +
          `1 = Math, 2 = Physics, 3 = Life Sciences, 4 = Chemistry`
      };
    }

    // Map numbers to subject names
    const subjectMap = {
      1: 'math',
      2: 'physics',
      3: 'life_sciences',
      4: 'chemistry'
    };

    // ✅ FIX: Define display names locally instead of using CONSTANTS
    const subjectDisplayNames = {
      'math': 'Mathematics',
      'physics': 'Physics',
      'life_sciences': 'Life Sciences',
      'chemistry': 'Chemistry'
    };

    const subjects = numbers.map((n) => subjectMap[n]);

    // ✅ FIX: Use local display names
    const selectedNames = numbers
      .map((n) => {
        const subjectKey = subjectMap[n];
        return `${n}=${subjectDisplayNames[subjectKey]}`;
      })
      .join(', ');

    console.log(`✅ Subjects validated: ${subjects.join(', ')} from input: "${input}"`);

    return {
      isValid: true,
      subjects: subjects,
      selectedNumbers: numbers,
      confirmation: selectedNames
    };
  } catch (error) {
    console.error(`❌ Subject validation error:`, error);
    return {
      isValid: false,
      error: `Something went wrong! Please try again with numbers 1-4! 🔄`
    };
  }
}
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

// ✅ NEW: Debug function for registration testing
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
