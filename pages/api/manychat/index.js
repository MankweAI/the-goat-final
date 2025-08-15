/**
 * The GOAT - Complete ManyChat Webhook Handler (FULLY FIXED)
 *
 * Architecture: ManyChat (External Request) -> This API Route -> Supabase
 * Update: Fixed all critical bugs, improved error handling, and security
 * Date: 2025-08-15 17:13:45 UTC
 */

import { executeQuery } from './config/database.js';
import { questionService } from './services/questionService.js';
import {
  findOrCreateUser,
  isUserRegistrationComplete,
  updateUserActivity,
  updateUser
} from './services/userService.js';
import {
  handleSubjectSwitchCommand,
  handleMathTopicSelection,
  handleInvalidTopicSelection
} from './handlers/subjectHandler.js';
import { menuHandler } from './handlers/menuHandler.js';
import { friendsService } from './services/friendsService.js';
import { hookService } from './services/hookService.js';
import { handleRegistration, getWelcomeMessage } from './handlers/registrationHandler.js';
import { handleQuestionRequest } from './handlers/questionHandler.js';
import { handleAnswerSubmission } from './handlers/answerHandler.js';
import { parseCommand } from './utils/commandParser.js';
import { formatResponse, formatErrorResponse } from './utils/responseFormatter.js';
import { formatQuestion } from './utils/questionFormatter.js';
import { aiService } from './services/aiService.js';
import { CONSTANTS } from './config/constants.js';
import { handlePostAnswerAction } from './handlers/postAnswerHandler.js';

export default async function handler(req, res) {
  const start = Date.now();

  console.log('🚀 ENHANCED CODE ACTIVE - 2025-08-15 17:13:45');
  console.log('✅ Features: Fixed bugs, improved error handling, enhanced security');

  if (req.method !== 'POST') {
    return res.status(405).json(
      formatErrorResponse('Method not allowed. Only POST requests are supported.', {
        allowed: ['POST'],
        elapsed_ms: Date.now() - start
      })
    );
  }

  const subscriberId = req.body.subscriber_id || req.body.psid;
  const message = req.body.message;

  if (!subscriberId || !message) {
    return res.status(400).json(
      formatErrorResponse('Missing required fields: subscriber_id and message', {
        subscriber_id: subscriberId,
        elapsed_ms: Date.now() - start
      })
    );
  }

  if (!/^\d+$/.test(String(subscriberId))) {
    console.warn(`⚠️ Non-numeric subscriberId: ${subscriberId}`);
  }

  if (message.length > 1000) {
    return res.status(400).json(
      formatErrorResponse('Message too long. Maximum 1000 characters allowed.', {
        subscriber_id: subscriberId,
        elapsed_ms: Date.now() - start
      })
    );
  }

  console.log(`📥 Webhook request from ${subscriberId}: "${message}"`);

  try {
    const user = await findOrCreateUser(subscriberId);
    if (!user) {
      throw new Error('Failed to find or create user');
    }

    console.log(
      `👤 User ${user.id} (${user.username || 'unregistered'}) - Menu: ${user.current_menu}`
    );

    await updateUserActivity(user.id);

    const isRegistered = await isUserRegistrationComplete(user);

    const command = parseCommand(message, {
      current_menu: user.current_menu,
      expecting_username: user.expecting_input === 'username_for_friend',
      expecting_challenge_username: user.expecting_input === 'username_for_challenge',
      expecting_registration_input: !isRegistered && user.display_name,
      has_current_question: !!user.current_question_id,
      expecting_answer: !!user.current_question_id
    });

    console.log(`🎯 Command parsed:`, {
      type: command.type,
      action: command.action,
      answer: command.answer,
      target: command.target,
      topicNumber: command.topicNumber,
      actionNumber: command.actionNumber,
      menu: user.current_menu,
      originalInput: command.originalInput
    });

    if (command.type === 'invalid_answer') {
      console.log(`❌ Invalid answer attempt: "${message}"`);
      return res.status(200).json(
        formatResponse(command.error, {
          subscriber_id: subscriberId,
          elapsed_ms: Date.now() - start,
          command_type: command.type,
          error: 'invalid_answer_format'
        })
      );
    }

    if (command.type === 'manual_hook') {
      const reply = await handleManualHook(user, command);
      return res.status(200).json(
        formatResponse(reply, {
          subscriber_id: subscriberId,
          elapsed_ms: Date.now() - start,
          command_type: command.type
        })
      );
    }

    if (command.type === 'hook_stats') {
      const reply = await handleHookStats(user);
      return res.status(200).json(
        formatResponse(reply, {
          subscriber_id: subscriberId,
          elapsed_ms: Date.now() - start,
          command_type: command.type
        })
      );
    }

    if (!isRegistered) {
      console.log(`📝 User ${user.id} needs registration`);

      if (!user.display_name && message.toLowerCase().trim() === 'hi') {
        const reply = getWelcomeMessage();
        return res.status(200).json(
          formatResponse(reply, {
            subscriber_id: subscriberId,
            elapsed_ms: Date.now() - start,
            registration_required: true
          })
        );
      }

      const registrationResult = await handleRegistration(user, message);
      if (registrationResult) {
        return res.status(200).json(
          formatResponse(registrationResult.reply, {
            subscriber_id: subscriberId,
            elapsed_ms: Date.now() - start,
            registration_step: true
          })
        );
      }
    }

    let reply = '';

    switch (command.type) {
      case 'main_menu':
        reply = await menuHandler.showMainMenu(user);
        break;

      case 'subject_menu':
        reply = await menuHandler.showSubjectMenu(user);
        break;

      case 'friends_menu':
        reply = await menuHandler.showFriendsMenu(user);
        break;

      case 'settings_menu':
        reply = await menuHandler.showSettingsMenu(user);
        break;

      case CONSTANTS.COMMAND_TYPES.QUESTION:
        reply = await handleQuestionCommand(user, command);
        break;

      case CONSTANTS.COMMAND_TYPES.ANSWER:
        console.log(`📝 Processing answer submission:`, command);
        reply = await handleAnswerSubmission(user, command);
        break;

      case CONSTANTS.COMMAND_TYPES.SUBJECT_SWITCH:
        console.log(`🔄 Subject switch to: ${command.target}`);
        if (command.target === 'math' || command.target === 'mathematics') {
          reply = await handleSubjectSwitchCommand(user, command);
        } else {
          reply = await handleDirectSubjectSwitch(user, command.target);
        }
        break;

      case 'math_topic_select':
        console.log(`🧮 Math topic selection: ${command.topicNumber}`);
        if (
          typeof command.topicNumber === 'number' &&
          command.topicNumber >= 1 &&
          command.topicNumber <= 9
        ) {
          reply = await handleMathTopicSelection(user, command.topicNumber);
        } else {
          reply = `Invalid math topic choice! Pick a number 1-9 from the math topics menu! 🧮`;
        }
        break;

      case CONSTANTS.COMMAND_TYPES.REPORT:
        reply = await handleReportCommand(user);
        break;

      case CONSTANTS.COMMAND_TYPES.FRIENDS:
        reply = await handleFriendsCommand(user, command);
        break;

      case 'post_answer_action':
        console.log(`🎯 Post-answer action: ${command.actionNumber}`);
        if (
          typeof command.actionNumber === 'number' &&
          command.actionNumber >= 1 &&
          command.actionNumber <= 5
        ) {
          reply = await handlePostAnswerAction(user, command.actionNumber);
        } else {
          reply = `Invalid action choice! Pick a number 1-5 from the menu above! 🎯`;
        }
        break;

      case 'invalid_option':
        reply = handleInvalidOption(command.menu, command.attempted, command.validRange);
        break;

      case 'invalid_text_command':
        reply = handleInvalidTextCommand(command.originalInput, user.current_menu);
        break;

      case CONSTANTS.COMMAND_TYPES.HELP:
        reply = generateHelpMessage(user);
        break;

      default:
        console.log(
          `⚠️ Unhandled command type: ${command.type}, input: "${command.originalInput || message}"`
        );

        if (user.current_question_id) {
          reply = `To answer the question, send A, B, C, or D! 🎯`;
        } else if (user.current_menu && user.current_menu !== 'main') {
          reply = `Invalid choice! Use the numbered options from the menu above! 🔢\n\nNeed help? Type "menu" to start fresh! 🏠`;
        } else {
          reply = await menuHandler.showMainMenu(user);
        }
    }

    const gptStats = aiService.getUsageStats();
    console.log(
      `🤖 GPT Stats: ${gptStats.requestCount} requests, ~$${gptStats.estimatedCost.toFixed(3)} cost`
    );
    console.log(
      `✅ Response generated (${reply.length} chars): ${reply.substring(0, 100)}${reply.length > 100 ? '...' : ''}`
    );

    return res.status(200).json(
      formatResponse(reply, {
        subscriber_id: subscriberId,
        elapsed_ms: Date.now() - start,
        command_type: command.type,
        command_details: {
          action: command.action,
          target: command.target,
          menu: user.current_menu,
          has_question: !!user.current_question_id
        },
        gpt_requests: gptStats.requestCount
      })
    );
  } catch (error) {
    console.error('💥 Webhook processing error:', {
      message: error.message,
      stack: error.stack,
      subscriberId,
      inputMessage: message,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json(
      formatErrorResponse('Internal processing error occurred', {
        subscriber_id: subscriberId,
        elapsed_ms: Date.now() - start,
        error_type: error.name || 'UnknownError'
      })
    );
  }
}

async function getCurrentQuestion(user) {
  try {
    if (!user.current_question_id) {
      return null;
    }

    return await executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('mcqs')
        .select('*')
        .eq('id', user.current_question_id)
        .single();

      if (error) {
        console.error(`❌ Get current question error:`, error);
        return null;
      }

      return data;
    });
  } catch (error) {
    console.error(`❌ getCurrentQuestion error:`, error);
    return null;
  }
}

async function clearUserQuestion(userId) {
  try {
    await updateUser(userId, {
      current_question_id: null,
      last_active_at: new Date().toISOString()
    });

    console.log(`✅ Cleared current question for user ${userId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error clearing user question for ${userId}:`, error);
    return false;
  }
}

async function handleQuestionCommand(user, command) {
  return await handleQuestionRequest(user, command);
}

async function handleDirectSubjectSwitch(user, subject) {
  await updateUser(user.id, { preferred_subjects: [subject], current_menu: null });
  return await handleQuestionRequest(user, { action: 'next', subject: subject });
}

async function handleReportCommand(user) {
  const totalQuestions = user.total_questions_answered || 0;
  const correctAnswers = user.total_correct_answers || 0;
  const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  const streak = user.streak_count || 0;

  await updateUser(user.id, {
    current_menu: 'main',
    last_active_at: new Date().toISOString()
  });

  let report = `🏆 **YOUR PROGRESS REPORT**\n\n`;
  report += `📈 **Overall Stats:**\n`;
  report += `• Questions answered: ${totalQuestions}\n`;
  report += `• Accuracy rate: ${accuracy}%\n`;
  report += `• Current streak: ${streak}\n\n`;
  report += `Ready for more? Type "next" for another question! 🚀`;
  return report;
}

async function handleFriendsCommand(user, command) {
  switch (command.action) {
    case 'add_user':
      return await friendsService.addFriend(user.id, command.target);
    default:
      return await menuHandler.showFriendsMenu(user);
  }
}

function handleInvalidOption(menu, attempted, validRange) {
  return `Eish, "${attempted}" is not a valid choice here. Please enter a number from ${validRange}.`;
}

function handleInvalidTextCommand(input, currentMenu) {
  if (currentMenu) {
    return `That command doesn't work in the current menu. Please use the numbered options or type "menu" to go back.`;
  }
  return `Sorry, I didn't recognize the command "${input}". Type "help" to see what I can do!`;
}

function generateHelpMessage(user) {
  return `Howzit! I'm The GOAT 🐐, here to help you ace your exams.\n\nHere are some commands you can use:\n- **"next"**: Get a new question.\n- **"menu"**: Show the main menu.\n- **"subjects"**: Choose a different subject.\n- **"report"**: See your progress.\n- **"friends"**: Manage your friends.\n\nSharp? Let's get learning!`;
}

async function handleManualHook(user, command) {
  return await hookService.triggerHook(user.id, command.target);
}

async function handleHookStats(user) {
  return await hookService.getHookStats(user.id);
}
