/**
 * The GOAT - Main Webhook Handler (Enhanced MVP)
 * Date: 2025-08-17 10:59:29 UTC
 * UPDATED: 3-option system with homework support and simplified exam prep
 */

import { findOrCreateUser, updateUserActivity, updateUser } from './services/userService.js';
import { parseCommand } from './utils/commandParser.js';
import { formatResponse, formatErrorResponse } from './utils/responseFormatter.js';
import { CONSTANTS, MESSAGES } from './config/constants.js';

import { examPrepHandler } from './handlers/examPrepHandler.js';
import { homeworkHandler } from './handlers/homeworkHandler.js';
import { practiceHandler } from './handlers/practiceHandler.js';

export default async function handler(req, res) {
  const start = Date.now();

  console.log('🚀 THE GOAT v3.0 - ENHANCED MVP: EXAM/HOMEWORK/PRACTICE');

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
      `👤 User ${user.id} | Menu: ${user.current_menu} | Sessions: E:${!!user.panic_session_id} H:${!!user.homework_session_id}`
    );

    await updateUserActivity(user.id);

    const command = parseCommand(message, {
      current_menu: user.current_menu,
      has_current_question: !!user.current_question_id,
      expecting_answer: !!user.current_question_id,
      expecting_text_input: isExpectingTextInput(user.current_menu)
    });

    console.log(`🎯 Command parsed: ${command.type}`, {
      action: command.action,
      menuChoice: command.menuChoice,
      originalInput: command.originalInput?.substring(0, 50)
    });

    let reply = '';

    // Route to appropriate handlers
    switch (command.type) {
      // ===== CORE FLOWS =====

      case 'welcome_menu':
      case 'unrecognized':
        reply = await showWelcomeMenu(user);
        break;

      case CONSTANTS.COMMAND_TYPES.EXAM_PREP:
        if (command.action === 'start') {
          reply = await examPrepHandler.startExamPrep(user);
        }
        break;

      case CONSTANTS.COMMAND_TYPES.HOMEWORK:
        if (command.action === 'start') {
          reply = await homeworkHandler.startHomeworkHelp(user);
        }
        break;

      case CONSTANTS.COMMAND_TYPES.PRACTICE:
        if (command.action === 'start') {
          reply = await practiceHandler.startPractice(user);
        }
        break;

      // ===== MENU NAVIGATION =====

      case 'exam_prep_subject_select':
        reply = await examPrepHandler.handleExamPrepMenu(user, command.menuChoice || 1);
        break;

      case 'homework_subject_select':
        reply = await homeworkHandler.handleHomeworkMenu(user, command.menuChoice || 1);
        break;

      case 'homework_problem_type_select':
        reply = await homeworkHandler.handleHomeworkMenu(user, command.menuChoice || 1);
        break;

      case 'homework_method_action':
        reply = await homeworkHandler.handleHomeworkMenu(user, command.menuChoice || 1);
        break;

      case 'lesson_action':
        if (user.homework_session_id) {
          reply = await homeworkHandler.handleHomeworkMenu(user, command.menuChoice || 1);
        } else {
          reply = await examPrepHandler.handleLessonAction(user, command.action);
        }
        break;

      case 'practice_continue_select':
        if (user.homework_session_id) {
          reply =
            (await homeworkHandler.handleHomeworkPracticeContinue?.(user, command.action)) ||
            (await practiceHandler.handlePracticeContinue(user, command.action));
        } else if (user.panic_session_id) {
          reply = await examPrepHandler.handleExamPracticeContinue(user, command.action);
        } else {
          reply = await practiceHandler.handlePracticeContinue(user, command.action);
        }
        break;

      // ===== TEXT INPUTS =====

      case 'text_input':
        reply = await handleTextInput(user, command.text);
        break;

      // ===== ANSWER HANDLING =====

      case CONSTANTS.COMMAND_TYPES.ANSWER:
        reply = await handleAnswerSubmission(user, command);
        break;

      case 'invalid_answer':
        reply = command.error;
        break;

      // ===== UTILITIES =====

      case CONSTANTS.COMMAND_TYPES.HELP:
        reply = await generateHelpMessage(user);
        break;

      case 'invalid_option':
        reply = `Pick a number from the options above (${command.validRange}). ✨`;
        break;

      // ===== FALLBACK =====

      default:
        console.log(`⚠️ Unhandled command: ${command.type}`);

        if (user.current_question_id) {
          reply = `To answer the question, send A, B, C, or D! 🎯`;
        } else if (user.current_menu && user.current_menu !== 'welcome') {
          reply = `Use the numbered options above, or type "menu" to start fresh. ✨`;
        } else {
          reply = await showWelcomeMenu(user);
        }
    }

    console.log(
      `✅ Response (${reply.length} chars): ${reply.substring(0, 100)}${reply.length > 100 ? '...' : ''}`
    );

    return res.status(200).json(
      formatResponse(reply, {
        subscriber_id: subscriberId,
        elapsed_ms: Date.now() - start,
        command_type: command.type,
        user_menu: user.current_menu,
        has_question: !!user.current_question_id
      })
    );
  } catch (error) {
    console.error('💥 Webhook error:', {
      message: error.message,
      stack: error.stack?.substring(0, 500),
      subscriberId,
      inputMessage: message,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json(
      formatErrorResponse("Something went wrong. Let's try again in a moment. ✨", {
        subscriber_id: subscriberId,
        elapsed_ms: Date.now() - start,
        error_type: error.name || 'UnknownError'
      })
    );
  }
}

// ===== CORE FUNCTIONS =====

async function showWelcomeMenu(user) {
  await updateUser(user.id, {
    current_menu: 'welcome',
    current_question_id: null,
    last_active_at: new Date().toISOString()
  });

  return MESSAGES.WELCOME.MAIN_MENU;
}

async function handleTextInput(user, text) {
  console.log(
    `📝 Text input: "${text.substring(0, 50)}" from user ${user.id}, menu: ${user.current_menu}`
  );

  // Route text inputs to appropriate handlers based on current session
  if (user.homework_session_id || user.current_menu?.startsWith('homework_')) {
    return await homeworkHandler.handleHomeworkText(user, text);
  }

  if (user.panic_session_id || user.current_menu?.startsWith('exam_prep_')) {
    return await examPrepHandler.handleExamPrepText(user, text);
  }

  return await showWelcomeMenu(user);
}

async function handleAnswerSubmission(user, command) {
  console.log(`📝 Answer submission: ${command.answer} from user ${user.id}`);

  if (user.homework_session_id) {
    return await homeworkHandler.handleHomeworkPracticeAnswer(user, command.answer);
  }

  if (user.panic_session_id) {
    return await examPrepHandler.handleExamPracticeAnswer(user, command.answer);
  }

  if (user.current_menu === 'practice_active') {
    return await practiceHandler.handlePracticeAnswer(user, command.answer);
  }

  return `No active question. Type "practice" to start practicing! 🧮`;
}

function generateHelpMessage(user) {
  return (
    `I'm here to help you study with calm and clarity. 🧠\n\n` +
    `🔄 **Key commands:**\n` +
    `• "exam" → Exam/test prep\n` +
    `• "homework" → Homework help\n` +
    `• "practice" → Question practice\n` +
    `• "menu" → Main options\n\n` +
    `📚 **For Grades 10-11 Maths**\n\n` +
    `What do you need right now? ✨`
  );
}

function isExpectingTextInput(currentMenu) {
  const textInputMenus = [
    'homework_confusion',
    'exam_prep_problems',
    'exam_prep_exam_date',
    'exam_prep_time',
    'homework_grade',
    'exam_prep_grade'
  ];

  return textInputMenus.includes(currentMenu);
}
