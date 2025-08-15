import {
  updateUser,
  isUsernameAvailable,
  isUserRegistrationComplete
} from '../services/userService.js';
import { validateUsername, validateGrade } from '../utils/validators.js';
import { CONSTANTS, MESSAGES } from '../config/constants.js';
import { questionService } from '../services/questionService.js'; // ✅ ADD THIS
import { formatQuestion } from '../utils/questionFormatter.js'; // ✅ ADD THIS
import { executeQuery } from '../config/database.js';

export async function handleRegistration(user, message) {
  try {
    console.log(`🔍 Registration check for user ${user.id}:`, {
      display_name: !!user.display_name,
      username: !!user.username,
      grade: !!user.grade,
      preferred_subjects: !!user.preferred_subjects?.length
    });

    const registrationState = determineRegistrationState(user);

    console.log(`📝 Registration state: ${registrationState}`);

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
        console.error(`❌ Unknown registration state: ${registrationState} for user ${user.id}`);
        return {
          reply: `Let's get you set up! What should I call you? 🎯`,
          shouldContinue: false
        };
    }
  } catch (error) {
    console.error(`❌ Registration error for user ${user.id}:`, error);
    return {
      reply: `Something went wrong during registration. Please try "hi" to restart! 🔄`,
      shouldContinue: false
    };
  }
}

function determineRegistrationState(user) {
  try {
    // Check what's missing in order
    if (!user.display_name) {
      return CONSTANTS.REGISTRATION_STATES.NEEDS_USERNAME;
    }

    if (!user.username) {
      return CONSTANTS.REGISTRATION_STATES.NEEDS_USERNAME;
    }

    if (!user.grade) {
      return CONSTANTS.REGISTRATION_STATES.NEEDS_GRADE;
    }

    if (!user.preferred_subjects || user.preferred_subjects.length === 0) {
      return CONSTANTS.REGISTRATION_STATES.NEEDS_SUBJECTS;
    }

    return CONSTANTS.REGISTRATION_STATES.COMPLETE;
  } catch (error) {
    console.error(`❌ Registration state determination error:`, error);
    return CONSTANTS.REGISTRATION_STATES.NEEDS_USERNAME;
  }
}

async function handleUsernameRegistration(user, message) {
  try {
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

    const validation = validateUsername(message);

    if (!validation.isValid) {
      return {
        reply: `Eish, ${validation.error}. Try something sharp like ${validation.suggestion}? 🎯`,
        shouldContinue: false
      };
    }

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
  } catch (error) {
    console.error(`❌ Username registration error:`, error);
    throw error;
  }
}

async function handleGradeRegistration(user, message) {
  try {
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
  } catch (error) {
    console.error(`❌ Grade registration error:`, error);
    throw error;
  }
}

// ✅ NEW: Get welcome question from user's preferred subjects
async function getWelcomeQuestion(user, preferredSubjects) {
  try {
    // Prioritize math if selected, otherwise pick first preferred subject
    const primarySubject = preferredSubjects.includes('math') ? 'math' : preferredSubjects[0];

    console.log(`🎯 Getting welcome question for user ${user.id}, subject: ${primarySubject}`);

    // Get a suitable welcome question
    const question = await questionService.getRandomQuestion(user, {
      subject: primarySubject,
      difficulty: 'easy', // Start with easy for welcome
      excludeRecent: false // No recent questions to exclude yet
    });

    if (question) {
      // Set this as user's current question
      await updateUser(user.id, {
        current_question_id: question.id,
        current_subject: primarySubject
      });

      // Update question served time
      await updateQuestionServedTime(question.id);

      console.log(`✅ Welcome question set: ${question.id} for user ${user.id}`);
    }

    return question;
  } catch (error) {
    console.error(`❌ Welcome question fetch error:`, error);
    return null;
  }
}

// ✅ ENHANCED: Welcome message with immediate question
async function generateWelcomeWithQuestion(username, subjectsList, question) {
  try {
    let welcomeMessage =
      `🎉 **WELCOME TO THE GOAT!** 🐐\n\n` +
      `Howzit @${username}! You're all set to dominate!\n\n` +
      `🎯 **Your subjects:** ${subjectsList}\n\n` +
      `Let's jump straight into action! Here's your first challenge:\n\n`;

    if (question) {
      // Add the question immediately
      welcomeMessage += `${formatQuestion(question)}\n\n`;
      welcomeMessage += `Just send the letter (A, B, C or D). Let's see what you've got! 🔥\n\n`;
      welcomeMessage += `💡 **Quick tip:** After answering, you can type "menu" anytime to see all options!`;
    } else {
      // Fallback if no question available
      welcomeMessage +=
        `Eish, couldn't load your first question right now! 😅\n\n` +
        `No stress - type "next" to get a question, or "menu" to see all options! 🚀`;
    }

    return welcomeMessage;
  } catch (error) {
    console.error(`❌ Welcome with question generation error:`, error);

    // Safe fallback
    return (
      `🎉 **WELCOME TO THE GOAT!** 🐐\n\n` +
      `Howzit @${username}! You're all set with: ${subjectsList}\n\n` +
      `Type "next" to get your first question! 🚀`
    );
  }
}

// ✅ NEW: Update question served timestamp
async function updateQuestionServedTime(questionId) {
  try {
    await executeQuery(async (supabase) => {
      const { error } = await supabase
        .from('mcqs')
        .update({ last_served_at: new Date().toISOString() })
        .eq('id', questionId);

      if (error) throw error;
    });
  } catch (error) {
    console.error(`⚠️ Question served time update failed:`, error);
    // Non-critical error, don't throw
  }
}

// ✅ FIXED: Removed registration_completed_at column reference
async function handleSubjectsRegistration(user, message) {
  try {
    const validation = validateSubjectsFromNumbers(message);

    if (!validation.isValid) {
      return {
        reply: `${validation.error}\n\n${MESSAGES.REGISTRATION.SUBJECTS_PROMPT}`,
        shouldContinue: false
      };
    }

    // Update user with subjects and set to question-ready state
    await updateUser(user.id, {
      preferred_subjects: validation.subjects,
      current_menu: 'question_active', // ✅ Ready for questions
      last_active_at: new Date().toISOString()
    });

    const subjectsList = validation.subjects
      .map((s) => CONSTANTS.SUBJECT_DISPLAY_NAMES[s] || s)
      .join(', ');

    console.log(`✅ Registration completed for user ${user.id}: subjects = ${subjectsList}`);

    // ✅ ENHANCED: Get immediate welcome question
    const welcomeQuestion = await getWelcomeQuestion(user, validation.subjects);

    return {
      reply: await generateWelcomeWithQuestion(user.username, subjectsList, welcomeQuestion),
      shouldContinue: false
    };
  } catch (error) {
    console.error(`❌ Subjects registration error:`, error);
    throw error;
  }
}

function validateSubjectsFromNumbers(input) {
  try {
    const trimmed = input.trim();
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

    const subjectMap = {
      1: 'math',
      2: 'physics',
      3: 'life_sciences',
      4: 'chemistry'
    };

    const subjectDisplayNames = {
      math: 'Mathematics',
      physics: 'Physics',
      life_sciences: 'Life Sciences',
      chemistry: 'Chemistry'
    };

    const subjects = numbers.map((n) => subjectMap[n]);

    console.log(`✅ Subjects validated: ${subjects.join(', ')} from input: "${input}"`);

    return {
      isValid: true,
      subjects: subjects,
      selectedNumbers: numbers
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
  try {
    const menuOptions = {
      1: { emoji: '🎯', description: 'Get Practice Question' },
      2: { emoji: '📚', description: 'Choose Subjects' },
      3: { emoji: '📊', description: 'Progress Report' },
      4: { emoji: '👥', description: 'Friends & Challenges' },
      5: { emoji: '⚙️', description: 'Settings' }
    };

    return (
      `🎉 **REGISTRATION COMPLETE!**\n\n` +
      `Welcome to The GOAT, @${username}! 🐐\n\n` +
      `🎯 **Your subjects:** ${subjectsList}\n\n` +
      `You're all set to dominate! Here's what you can do:\n\n` +
      `🏠 **MAIN MENU:**\n` +
      `1️⃣ ${menuOptions[1].emoji} ${menuOptions[1].description}\n` +
      `2️⃣ ${menuOptions[2].emoji} ${menuOptions[2].description} (Math has 8 topics!)\n` +
      `3️⃣ ${menuOptions[3].emoji} ${menuOptions[3].description}\n` +
      `4️⃣ ${menuOptions[4].emoji} ${menuOptions[4].description}\n` +
      `5️⃣ ${menuOptions[5].emoji} ${menuOptions[5].description}\n\n` +
      `💡 **Adding friends:** They can find you by searching @${username}\n\n` +
      `Ready to start? Type the number! 🔥`
    );
  } catch (error) {
    console.error(`❌ Welcome message generation error:`, error);
    return `🎉 **REGISTRATION COMPLETE!**\n\nWelcome @${username}! 🐐\n\nType "menu" to get started! 🚀`;
  }
}

export function getWelcomeMessage() {
  return MESSAGES.REGISTRATION.WELCOME;
}

export function getUserRegistrationState(user) {
  return determineRegistrationState(user);
}
