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

  await updateUser(user.id, {
    grade: validation.grade,
    last_active_at: new Date().toISOString()
  });

  const gradeDisplay = validation.grade === 'varsity' ? 'University' : `Grade ${validation.grade}`;

  return {
    reply: `Perfect! ${gradeDisplay} student 🎓\n\n${MESSAGES.REGISTRATION.SUBJECTS_PROMPT}`,
    shouldContinue: false
  };
}

async function handleSubjectsRegistration(user, message) {
  const input = message.trim();

  // Parse subject numbers
  const numbers = input
    .split(/[,\s]+/)
    .map((n) => parseInt(n.trim(), 10))
    .filter((n) => !isNaN(n));

  if (numbers.length === 0 || numbers.some((n) => n < 1 || n > 4)) {
    return {
      reply: `Invalid selection! 📝\n\nPick numbers 1-4 for subjects:\n• 1 = Math\n• 2 = Physics\n• 3 = Life Sciences\n• 4 = Chemistry\n\nExample: 1,3 for Math and Life Sciences`,
      shouldContinue: false
    };
  }

  const subjectMap = {
    1: 'math',
    2: 'physics',
    3: 'life_sciences',
    4: 'chemistry'
  };

  const selectedSubjects = numbers.map((n) => subjectMap[n]);
  const displayNames = selectedSubjects.map((s) => CONSTANTS.SUBJECT_DISPLAY_NAMES[s]);

  await updateUser(user.id, {
    preferred_subjects: selectedSubjects,
    current_menu: 'main',
    last_active_at: new Date().toISOString()
  });

  // Get first question
  const question = await questionService.getNextQuestion(user.id);
  let response = `🎉 **REGISTRATION COMPLETE!** 🐐\n\n`;
  response += `📚 **Your subjects:** ${displayNames.join(', ')}\n`;
  response += `🎓 **Grade:** ${user.grade === 'varsity' ? 'University' : `Grade ${user.grade}`}\n\n`;
  response += `🔥 **You're ready to dominate!**\n\n`;

  if (question) {
    await questionService.serveQuestionToUser(user.id, question.id);
    response += `Here's your first question:\n\n${formatQuestion(question)}`;
  } else {
    response += `Type "next" to get your first question! 🚀`;
  }

  return {
    reply: response,
    shouldContinue: false
  };
}

export function getWelcomeMessage() {
  return MESSAGES.REGISTRATION.WELCOME;
}

export function getUserRegistrationState(user) {
  return determineRegistrationState(user);
}
