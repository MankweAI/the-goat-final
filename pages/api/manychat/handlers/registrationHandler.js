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

// ✅ ENHANCED: Registration completion with robust question fetching
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
      current_menu: 'question_active',
      last_active_at: new Date().toISOString()
    });

    const subjectsList = validation.subjects
      .map((s) => CONSTANTS.SUBJECT_DISPLAY_NAMES[s] || s)
      .join(', ');

    console.log(`✅ Registration completed for user ${user.id}: subjects = ${subjectsList}`);

    // ✅ ENHANCED: Try to get welcome question with fallback
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

// ✅ ENHANCED: Robust welcome question fetching with multiple fallbacks
async function getWelcomeQuestion(user, preferredSubjects) {
  try {
    console.log(
      `🎯 Getting welcome question for user ${user.id}, subjects: ${preferredSubjects.join(', ')}`
    );

    // Strategy 1: Try preferred subjects in order
    for (const subject of preferredSubjects) {
      console.log(`🔍 Trying subject: ${subject}`);

      try {
        const question = await questionService.getRandomQuestion(user, {
          subject: subject,
          difficulty: 'easy',
          excludeRecent: false
        });

        if (question) {
          console.log(`✅ Found question ${question.id} for subject ${subject}`);

          // Set this as user's current question
          await updateUser(user.id, {
            current_question_id: question.id,
            current_subject: subject
          });

          // Update question served time
          await updateQuestionServedTime(question.id);

          return question;
        }
      } catch (subjectError) {
        console.error(`❌ Failed to get question for ${subject}:`, subjectError);
        continue; // Try next subject
      }
    }

    // Strategy 2: Try any subject with any difficulty
    console.log(`🔄 No easy questions found, trying any difficulty...`);

    for (const subject of preferredSubjects) {
      try {
        const question = await questionService.getRandomQuestion(user, {
          subject: subject,
          excludeRecent: false
        });

        if (question) {
          console.log(`✅ Found backup question ${question.id} for subject ${subject}`);

          await updateUser(user.id, {
            current_question_id: question.id,
            current_subject: subject
          });

          await updateQuestionServedTime(question.id);
          return question;
        }
      } catch (subjectError) {
        console.error(`❌ Failed to get backup question for ${subject}:`, subjectError);
        continue;
      }
    }

    // Strategy 3: Try any available question regardless of subject
    console.log(`🔄 No subject-specific questions found, trying any question...`);

    try {
      const question = await getAnyAvailableQuestion(user);

      if (question) {
        console.log(`✅ Found fallback question ${question.id}`);

        await updateUser(user.id, {
          current_question_id: question.id,
          current_subject: question.subject || preferredSubjects[0]
        });

        await updateQuestionServedTime(question.id);
        return question;
      }
    } catch (fallbackError) {
      console.error(`❌ Failed to get fallback question:`, fallbackError);
    }

    console.log(`❌ No questions available for user ${user.id}`);
    return null;
  } catch (error) {
    console.error(`❌ Welcome question fetch error:`, error);
    return null;
  }
}

// ✅ NEW: Get any available question as ultimate fallback
async function getAnyAvailableQuestion(user) {
  try {
    return await executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('mcqs')
        .select('*')
        .eq('is_active', true)
        .order('last_served_at', { ascending: true, nullsFirst: true })
        .limit(1)
        .single();

      if (error) {
        console.error(`❌ Fallback question query error:`, error);
        return null;
      }

      return data;
    });
  } catch (error) {
    console.error(`❌ getAnyAvailableQuestion error:`, error);
    return null;
  }
}

// ✅ ENHANCED: Welcome message with better fallback handling
async function generateWelcomeWithQuestion(username, subjectsList, question) {
  try {
    let welcomeMessage =
      `🎉 **WELCOME TO THE GOAT!** 🐐\n\n` +
      `Howzit @${username}! You're all set to dominate!\n\n` +
      `🎯 **Your subjects:** ${subjectsList}\n\n`;

    if (question) {
      // Success case - got a question
      welcomeMessage += `Let's jump straight into action! Here's your first challenge:\n\n`;
      welcomeMessage += `${formatQuestion(question)}\n\n`;
      welcomeMessage += `Just send the letter (A, B, C or D). Let's see what you've got! 🔥\n\n`;
      welcomeMessage += `💡 **Quick tip:** After answering, you can type "menu" anytime to see all options!`;

      console.log(`✅ Welcome message with question generated for @${username}`);
    } else {
      // Fallback case - no question available
      welcomeMessage += `Ready to start learning? Type "next" to get your first question!\n\n`;
      welcomeMessage += `🎯 **Quick commands:**\n`;
      welcomeMessage += `• "next" - Get a practice question\n`;
      welcomeMessage += `• "menu" - See all options\n`;
      welcomeMessage += `• "help" - Get help\n\n`;
      welcomeMessage += `Let's dominate together! 🚀`;

      console.log(`⚠️ Welcome message without question (fallback) for @${username}`);
    }

    return welcomeMessage;
  } catch (error) {
    console.error(`❌ Welcome message generation error:`, error);

    // Ultra-safe fallback
    return (
      `🎉 **WELCOME TO THE GOAT!** 🐐\n\n` +
      `Howzit @${username}! You're all set with: ${subjectsList}\n\n` +
      `Type "next" to get your first question! 🚀`
    );
  }
}

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

export function getWelcomeMessage() {
  return MESSAGES.REGISTRATION.WELCOME;
}

export function getUserRegistrationState(user) {
  return determineRegistrationState(user);
}
