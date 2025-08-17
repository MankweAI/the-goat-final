/**
 * The GOAT - Main Webhook Handler (Enhanced MVP) - COMPLETE REWRITE
 * Date: 2025-08-17 15:52:37 UTC
 * CRITICAL FIXES:
 * - Added all missing exam prep plan action handling
 * - Enhanced text input routing with exam date support
 * - Fixed lesson menu routing with context awareness
 * - Comprehensive error handling and logging
 */

import { findOrCreateUser, updateUserActivity, updateUser } from './services/userService.js';
import { parseCommand, isExpectingTextInput } from './utils/commandParser.js';
import { formatResponse, formatErrorResponse } from './utils/responseFormatter.js';
import { CONSTANTS, MESSAGES } from './config/constants.js';

import { examPrepHandler } from './handlers/examPrepHandler.js';
import { homeworkHandler } from './handlers/homeworkHandler.js';
import { practiceHandler } from './handlers/practiceHandler.js';

export default async function handler(req, res) {
  const start = Date.now();

  console.log('🚀 THE GOAT v3.1 - ENHANCED MVP: EXAM/HOMEWORK/PRACTICE WITH BUG FIXES');

  if (req.method !== 'POST') {
    return res.status(405).json(
      formatErrorResponse('Only POST requests supported', {
        allowed: ['POST'],
        elapsed_ms: Date.now() - start
      })
    );
  }

  const subscriberId = req.body.subscriber_id || req.body.psid;
  const message = req.body.message;

  if (!subscriberId || !message) {
    return res.status(400).json(
      formatErrorResponse('Missing subscriber_id or message', {
        subscriber_id: subscriberId,
        elapsed_ms: Date.now() - start
      })
    );
  }

  console.log(`📥 Message from ${subscriberId}: "${message.substring(0, 100)}"`);

  try {
    const user = await findOrCreateUser(subscriberId);
    if (!user) {
      throw new Error('Failed to find or create user');
    }

    console.log(
      `👤 User ${user.id} | Menu: ${user.current_menu} | H:${!!user.homework_session_id}`
    );

    await updateUserActivity(user.id);

    const command = parseCommand(message, {
      current_menu: user.current_menu,
      has_current_question: !!user.current_question_id,
      expecting_answer: !!user.current_question_id,
      expecting_text_input: isExpectingTextInput(user.current_menu)
    });

    // Defensive programming - ensure command has required properties
    const safeCommand = {
      type: command.type || 'unrecognized',
      action: command.action || null,
      menuChoice: command.menuChoice || null,
      text: command.text || null,
      answer: command.answer || null,
      validRange: command.validRange || '1-5',
      originalInput: command.originalInput || message,
      ...command
    };

    console.log(`🎯 Command parsed: ${safeCommand.type}`, {
      action: safeCommand.action,
      menuChoice: safeCommand.menuChoice,
      text: safeCommand.text?.substring(0, 30),
      originalInput: safeCommand.originalInput?.substring(0, 50)
    });

    let reply = '';

    // Route to appropriate handlers
    switch (safeCommand.type) {
      // ===== CORE FLOWS =====

      case 'welcome_menu':
      case 'unrecognized':
        reply = await showWelcomeMenu(user);
        break;

      case CONSTANTS.COMMAND_TYPES.EXAM_PREP:
        if (safeCommand.action === 'start') {
          reply = await examPrepHandler.startExamPrep(user);
        }
        break;

      case CONSTANTS.COMMAND_TYPES.HOMEWORK:
        if (safeCommand.action === 'start') {
          reply = await homeworkHandler.startHomework(user);
        }
        break;

      case CONSTANTS.COMMAND_TYPES.PRACTICE:
        if (safeCommand.action === 'start') {
          reply = await practiceHandler.startPractice(user);
        }
        break;

      case CONSTANTS.COMMAND_TYPES.ANSWER:
        reply = await handleAnswerSubmission(user, safeCommand.answer);
        break;

      // ===== EXAM PREP SPECIFIC =====

      case 'exam_prep_subject':
        reply = await examPrepHandler.handleExamPrepMenu(user, safeCommand.menuChoice);
        break;

      // CRITICAL FIX: Added missing exam prep plan action handling
      case 'exam_prep_plan_action':
        reply = await examPrepHandler.handleExamPrepPlanAction(user, safeCommand.action);
        break;

      // CRITICAL FIX: Added exam lesson menu handling
      case 'exam_lesson_menu':
        reply = await examPrepHandler.handleExamLessonMenu(user, safeCommand.menuChoice);
        break;

      // ===== HOMEWORK SPECIFIC =====

      case 'homework_subject':
        reply = await homeworkHandler.handleHomeworkMenu(user, safeCommand.menuChoice);
        break;

      case 'homework_lesson_menu':
        reply = await homeworkHandler.handleHomeworkLessonMenu(user, safeCommand.menuChoice);
        break;

      // ===== PRACTICE SPECIFIC =====

      case 'practice_continue':
        reply = await practiceHandler.handlePracticeContinue(user, safeCommand.action);
        break;


      // ===== TEXT INPUT HANDLING =====

      case 'text_input':
        reply = await handleTextInput(user, safeCommand.text);
        break;

      // ===== ERROR HANDLING =====

      case 'invalid_answer':
        reply = MESSAGES.ERRORS.INVALID_ANSWER;
        break;

      case 'invalid_option':
        reply = `${MESSAGES.ERRORS.INVALID_MENU_OPTION}\n\nValid range: ${safeCommand.validRange}`;
        break;

      default:
        console.warn(`⚠️ Unhandled command type: ${safeCommand.type}`);
        reply = await showWelcomeMenu(user);
        break;
    }

    console.log(`✅ Reply generated (${reply.length} chars)`);

    // Update user's last interaction
    await updateUser(user.id, {
      last_active_at: new Date().toISOString()
    });

    return res.status(200).json(
      formatResponse(reply, {
        user_id: user.id,
        command_type: safeCommand.type,
        elapsed_ms: Date.now() - start
      })
    );
  } catch (error) {
    console.error('❌ Handler error:', error);

    const errorReply =
      process.env.NODE_ENV === 'development' ? `Error: ${error.message}` : MESSAGES.ERRORS.GENERIC;

    return res.status(500).json(
      formatErrorResponse(errorReply, {
        error: error.message,
        elapsed_ms: Date.now() - start
      })
    );
  }
}

// ===== HELPER FUNCTIONS =====

async function showWelcomeMenu(user) {
  console.log(`🏠 Showing welcome menu to user ${user.id}`);

  await updateUser(user.id, {
    current_menu: 'welcome',
    current_question_id: null,
    homework_session_id: null
  });

  return MESSAGES.WELCOME.MAIN_MENU;
}

async function handleAnswerSubmission(user, answer) {
  console.log(`📝 Answer submission from user ${user.id}: ${answer}`);

  if (!user.current_question_id) {
    return MESSAGES.ERRORS.NO_QUESTION_ACTIVE;
  }

  // Determine context based on current menu
  const context = user.current_menu;

  if (context === 'practice_active') {
    return await practiceHandler.handlePracticeAnswer(user, answer);
  } else if (context === 'exam_practice_active' || user.exam_practice_context) {
    return await examPrepHandler.handleExamPracticeAnswer(user, answer);
  } else if (context === 'homework_practice_active') {
    return await homeworkHandler.handleHomeworkPracticeAnswer(user, answer);
  } else {
    // Default to practice handler
    return await practiceHandler.handlePracticeAnswer(user, answer);
  }
}

async function handleTextInput(user, text) {
  console.log(`📝 Text input from user ${user.id}: "${text.substring(0, 50)}"`);

  const currentMenu = user.current_menu;

  switch (currentMenu) {
    // ===== EXAM PREP TEXT INPUTS =====

    case 'exam_prep_grade':
    case 'exam_prep_exam_date':
    case 'exam_prep_problems':
    case 'exam_prep_time':
      return await examPrepHandler.handleExamPrepText(user, text);

    // ===== HOMEWORK TEXT INPUTS =====

    case 'homework_grade':
    case 'homework_confusion':
      return await homeworkHandler.handleHomeworkText(user, text);

    // ===== GENERAL GRADE INPUT =====

    case 'ask_grade':
      return await handleGradeInput(user, text);

    default:
      console.warn(`⚠️ Unhandled text input menu: ${currentMenu}`);
      return `I didn't understand that input. Type "menu" to go back to the main menu. ✨`;
  }
}

async function handleGradeInput(user, text) {
  const grade = text.trim().toLowerCase();

  if (!CONSTANTS.VALID_GRADES.includes(grade)) {
    return `Please enter a valid grade: 10, 11, or varsity. 🎓`;
  }

  await updateUser(user.id, {
    grade,
    current_menu: 'welcome'
  });

  return `Grade ${grade} saved! 📚\n\n${MESSAGES.WELCOME.MAIN_MENU}`;
}

// ===== UTILITY FUNCTIONS =====

// function formatResponse(message, metadata = {}) {
//   return {
//     success: true,
//     message,
//     timestamp: new Date().toISOString(),
//     metadata
//   };
// }

// function formatErrorResponse(error, metadata = {}) {
//   return {
//     success: false,
//     error,
//     timestamp: new Date().toISOString(),
//     metadata
//   };
// }

// Export utility functions for testing
export {
  showWelcomeMenu,
  handleAnswerSubmission,
  handleTextInput,
  formatResponse,
  formatErrorResponse
};
