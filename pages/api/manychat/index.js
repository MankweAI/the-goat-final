/**
 * The GOAT - Main Webhook Handler (Stress & Confidence Focus)
 * Date: 2025-08-16 17:24:11 UTC
 * FIXED: Contextual input handling for grade collection
 */

import { findOrCreateUser, updateUserActivity, updateUser } from './services/userService.js';
import { parseCommand } from './utils/commandParser.js';
import { formatResponse, formatErrorResponse } from './utils/responseFormatter.js';
import { CONSTANTS, MESSAGES } from './config/constants.js';

import { stressHandler } from './handlers/stressHandler.js';
import { confidenceHandler } from './handlers/confidenceHandler.js';
import { practiceHandler } from './handlers/practiceHandler.js';

export default async function handler(req, res) {
  const start = Date.now();

  console.log('🚀 THE GOAT v2.0 - STRESS & CONFIDENCE PLATFORM ACTIVE');

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
      `👤 User ${user.id} | Menu: ${user.current_menu} | ExpectingInput: ${user.expecting_input_type}`
    );

    await updateUserActivity(user.id);

    // CRITICAL FIX: Enhanced context for command parsing
    const command = parseCommand(message, {
      current_menu: user.current_menu,
      has_current_question: !!user.current_question_id,
      expecting_answer: !!user.current_question_id,
      expecting_input_type: user.expecting_input_type, // NEW: Critical for grade input
      expecting_registration_input: false
    });

    console.log(`🎯 Command parsed: ${command.type}`, {
      action: command.action,
      inputType: command.input_type,
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

      case CONSTANTS.COMMAND_TYPES.STRESSED:
        if (command.action === 'start') {
          reply = await stressHandler.startStressSupport(user);
        }
        break;

      case CONSTANTS.COMMAND_TYPES.CONFIDENCE_BOOST:
        if (command.action === 'start') {
          reply = await confidenceHandler.startConfidenceBoost(user);
        }
        break;

      case CONSTANTS.COMMAND_TYPES.PRACTICE:
        if (command.action === 'start') {
          reply = await practiceHandler.startPractice(user);
        }
        break;

      // ===== CRITICAL FIX: Contextual inputs =====

      case 'contextual_input':
        reply = await handleContextualInput(user, command.originalInput, command.input_type);
        break;

      // ===== MENU NAVIGATION =====

      case 'stress_level_select':
        reply = await stressHandler.handleStressMenu(user, command.level);
        break;

      case 'stress_subject_select':
        reply = await stressHandler.handleStressMenu(user, command.menuChoice);
        break;

      case 'confidence_reason_select':
        reply = await confidenceHandler.handleConfidenceMenu(user, command.menuChoice);
        break;

      case 'confidence_ladder_select':
        reply = await confidenceHandler.handleConfidenceMenu(user, command.menuChoice);
        break;

      case 'lesson_action':
        reply = await stressHandler.handleLessonAction(user, command.action);
        break;

      case 'practice_continue_select':
        if (user.current_menu === 'practice_continue') {
          reply = await practiceHandler.handlePracticeContinue(user, command.action);
        } else {
          reply = await stressHandler.handlePracticeContinue(user, command.action);
        }
        break;

      // ===== ANSWER HANDLING =====

      case CONSTANTS.COMMAND_TYPES.ANSWER:
        reply = await handleAnswerSubmission(user, command);
        break;

      case 'invalid_answer':
        reply = command.error;
        break;

      // ===== LEGACY TEXT INPUTS =====

      case 'registration':
        reply = await handleLegacyContextualInput(user, command.originalInput);
        break;

      // ===== UTILITIES =====

      case CONSTANTS.COMMAND_TYPES.HELP:
        reply = await generateHelpMessage(user);
        break;

      case 'invalid_option':
        reply = `Pick a number from the options above (${command.validRange}). ✨`;
        break;

      case 'plan_cancel':
        reply = await handlePlanCancel(user);
        break;

      case 'plan_time_change':
        reply = await handleTimeChange(user, command.time);
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
    expecting_input_type: null, // Clear any expecting input state
    last_active_at: new Date().toISOString()
  });

  return MESSAGES.WELCOME.MAIN_MENU;
}

// CRITICAL FIX: Enhanced contextual input handling
async function handleContextualInput(user, input, inputType) {
  console.log(`📝 Contextual input: type="${inputType}", input="${input}" from user ${user.id}`);

  // Route based on input type
  if (inputType === 'grade' || inputType === 'exam_date' || inputType === 'preferred_time') {
    return await stressHandler.handleStressText(user, input);
  }

  if (inputType?.startsWith('confidence_')) {
    return (
      (await confidenceHandler.handleConfidenceText?.(user, input)) ||
      `Please pick a number from the options above. 🫶`
    );
  }

  // Fallback to legacy handling
  return await handleLegacyContextualInput(user, input);
}

async function handleLegacyContextualInput(user, input) {
  console.log(
    `📝 Legacy contextual input: "${input}" from user ${user.id}, menu: ${user.current_menu}`
  );

  // Route contextual inputs to appropriate handlers
  if (user.current_menu?.startsWith('stress_') || user.panic_session_id) {
    return await stressHandler.handleStressText(user, input);
  }

  if (user.current_menu?.startsWith('confidence_') || user.therapy_session_id) {
    return `Please pick a number from the options above. 🫶`;
  }

  return await showWelcomeMenu(user);
}

async function handleAnswerSubmission(user, command) {
  console.log(`📝 Answer submission: ${command.answer} from user ${user.id}`);

  if (user.current_menu === 'stress_practice' || user.panic_session_id) {
    return await stressHandler.handlePracticeAnswer(user, command.answer);
  }

  if (user.current_menu === 'confidence_practice' || user.therapy_session_id) {
    return await confidenceHandler.handlePracticeAnswer(user, command.answer);
  }

  if (user.current_menu === 'practice_active') {
    return await practiceHandler.handlePracticeAnswer(user, command.answer);
  }

  return `No active question. Type "practice" to start practicing! 🧮`;
}

async function handlePlanCancel(user) {
  await updateUser(user.id, {
    current_menu: 'welcome',
    panic_session_id: null,
    therapy_session_id: null,
    expecting_input_type: null,
    last_active_at: new Date().toISOString()
  });

  return (
    `Study plan cancelled. No stress.\n\n` +
    `Type "stressed", "boost", or "practice" when you're ready. 🌱`
  );
}

async function handleTimeChange(user, timeString) {
  const timeMatch = timeString.match(/(\d{1,2})\s*([ap]m)?/i);

  if (timeMatch) {
    const hour = parseInt(timeMatch[1]);
    const isPM = timeMatch[2]?.toLowerCase() === 'pm';
    const hour24 = isPM && hour !== 12 ? hour + 12 : !isPM && hour === 12 ? 0 : hour;

    await updateUser(user.id, {
      expecting_input_type: null,
      last_active_at: new Date().toISOString()
    });

    return (
      `Time updated to ${timeString}. ⏰\n\n` +
      `I'll send daily reminders at that time.\n\n` +
      `Type "practice" to continue or "menu" for options! ✨`
    );
  }

  return `Try a time like "7pm" or "19:00". ⏰`;
}

function generateHelpMessage(user) {
  return (
    `I'm here to help you study with calm and clarity. 🧠\n\n` +
    `🔄 **Key commands:**\n` +
    `• "stressed" → Stress support\n` +
    `• "boost" → Confidence help\n` +
    `• "practice" → Question practice\n` +
    `• "menu" → Main options\n\n` +
    `📚 **For Grades 10-11 Maths**\n\n` +
    `What do you need right now? ✨`
  );
}
