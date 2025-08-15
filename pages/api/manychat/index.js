/**
 * The GOAT - Complete ManyChat Webhook Handler (CORRECTED)
 *
 * Architecture: ManyChat (External Request) -> This API Route -> Supabase
 * Update: Fixed imports, function calls, and parameter passing
 */

// ========== CORRECTED IMPORTS ==========
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
import { handleAnswerSubmission } from './handlers/answerHandler.js'; // ✅ DIRECT IMPORT
import { parseCommand } from './utils/commandParser.js';
import { formatResponse, formatErrorResponse } from './utils/responseFormatter.js';
import { aiService } from './services/aiService.js';
import { CONSTANTS } from './config/constants.js';
import { handlePostAnswerAction } from './handlers/postAnswerHandler.js';

// ========== MAIN HANDLER ==========
export default async function handler(req, res) {
  const start = Date.now();

  // 🚨 DEPLOYMENT VERIFICATION
  console.log('🚀 ENHANCED CODE ACTIVE - 2025-08-15 11:05:47');
  console.log('✅ Features: Answer validation, Sub-topics, Post-answer experience');

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json(
      formatErrorResponse('Method not allowed. Only POST requests are supported.', {
        allowed: ['POST'],
        elapsed_ms: Date.now() - start
      })
    );
  }

  // Extract and validate input
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

  // Log incoming request with enhanced info
  console.log(`📥 Webhook request from ${subscriberId}: "${message}"`);

  // Validate WhatsApp subscriber ID format
  if (!/^\d+$/.test(String(subscriberId))) {
    console.warn(`⚠️  Non-numeric subscriberId: ${subscriberId}`);
  }

  try {
    // Find or create user
    const user = await findOrCreateUser(subscriberId);
    console.log(
      `👤 User ${user.id} (${user.username || 'unregistered'}) - Menu: ${user.current_menu}`
    );

    // Update user activity
    await updateUserActivity(user.id);

    // Check if user needs to complete registration
    const isRegistered = await isUserRegistrationComplete(user);

    // ✅ ENHANCED: Parse command with complete context
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
      topicNumber: command.topicNumber,
      actionNumber: command.actionNumber,
      menu: user.current_menu
    });

    // PRIORITY 1: HANDLE INVALID ANSWERS
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

    // PRIORITY 2: HANDLE HOOK COMMANDS FIRST
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

    // PRIORITY 3: REGISTRATION FLOW
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

    // PRIORITY 4: COMMAND HANDLING
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
        // ✅ FIXED: Direct call to handleAnswerSubmission with proper parameters
        console.log(`📝 Processing answer submission:`, command);
        reply = await handleAnswerSubmission(user, command);
        break;

      case CONSTANTS.COMMAND_TYPES.SUBJECT_SWITCH:
        console.log(`🔄 Subject switch to: ${command.target}`);
        reply = await handleSubjectSwitchCommand(user, command);
        break;

      // ✅ ENHANCED: Math topic selection
      case 'math_topic_select':
        console.log(`🧮 Math topic selection: ${command.topicNumber}`);
        reply = await handleMathTopicSelection(user, command.topicNumber);
        break;

      case CONSTANTS.COMMAND_TYPES.REPORT:
        reply = await handleReportCommand(user);
        break;

      case CONSTANTS.COMMAND_TYPES.FRIENDS:
        reply = await handleFriendsCommand(user, command);
        break;

      // ✅ ENHANCED: Post-answer action handler
      case 'post_answer_action':
        console.log(`🎯 Post-answer action: ${command.actionNumber}`);
        reply = await handlePostAnswerAction(user, command.actionNumber);
        break;

      // ✅ ENHANCED: Invalid option handler with context
      case 'invalid_option':
        reply = handleInvalidOption(command.menu, command.attempted, command.validRange);
        break;

      case CONSTANTS.COMMAND_TYPES.HELP:
        reply = generateHelpMessage(user);
        break;

      default:
        console.log(`⚠️ Unhandled command type: ${command.type}`);
        reply = await menuHandler.showMainMenu(user);
    }

    // ✅ ENHANCED: Better logging
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

// ===============================
// ✅ CORRECTED HELPER FUNCTIONS
// ===============================

async function handleQuestionCommand(user, command) {
  try {
    console.log(`🎯 Question command: ${command.action}`);
    if (command.action === 'next') {
      return await handleQuestionRequest(user, command);
    }
    return `Type "next" for a question! 🎯`;
  } catch (error) {
    console.error('❌ Question command error:', error);
    return `Eish, couldn't get a question right now. Try again in a moment! 🎯`;
  }
}

async function handleReportCommand(user) {
  try {
    const totalQuestions = user.total_questions_answered || 0;
    const correctAnswers = user.total_correct_answers || 0;
    const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    const streak = user.streak_count || 0;

    let report = `🏆 **YOUR PROGRESS REPORT**\n\n`;
    report += `📈 **Overall Stats:**\n`;
    report += `• Questions answered: ${totalQuestions}\n`;
    report += `• Accuracy rate: ${accuracy}%\n`;
    report += `• Current streak: ${streak}\n`;
    report += `• Level: ${getLevel(totalQuestions)}\n\n`;

    if (accuracy >= 80) {
      report += `🔥 Outstanding performance! You're crushing it!\n\n`;
    } else if (accuracy >= 60) {
      report += `💪 Good progress! Keep pushing forward!\n\n`;
    } else {
      report += `📚 Keep practicing! Every question makes you stronger!\n\n`;
    }

    report += `Ready for more? Type "next" for another question! 🚀`;
    return report;
  } catch (error) {
    console.error('❌ Report command error:', error);
    return `Eish, couldn't load your report right now. Try again in a bit! 📊`;
  }
}

async function handleFriendsCommand(user, command) {
  try {
    switch (command.action) {
      case 'list':
        const friendsList = await friendsService.getUserFriends(user.id);
        return friendsList.message;

      case 'add_prompt':
        await updateUser(user.id, { expecting_input: 'username_for_friend' });
        return `👥 **ADD A FRIEND**\n\nType their username (like: john123)\n\nThey'll appear in your friends list once added! 🎯`;

      case 'add_user':
        await updateUser(user.id, { expecting_input: null });
        const result = await friendsService.addFriendByUsername(user.id, command.target);
        return result.message;

      default:
        return await menuHandler.showFriendsMenu(user);
    }
  } catch (error) {
    console.error('❌ Friends command error:', error);
    return `Eish, friends feature glitched! Try "menu" to continue! 👥`;
  }
}

async function handleManualHook(user, command) {
  try {
    const hookType = command.target;
    const validTypes = ['morning', 'afternoon', 'evening', 'fomo', 'comeback'];

    if (!validTypes.includes(hookType)) {
      return `🎣 **HOOK TESTER**\n\nValid types: ${validTypes.join(', ')}\n\nExample: "hook morning"`;
    }

    const hook = await hookService.getHookForUser(user.id, `${hookType}_hook`);
    if (!hook) {
      return `No ${hookType} hook available right now! 🎣\n\nTry: "hook morning" or "hook evening"`;
    }

    return `🎣 **${hookType.toUpperCase()} HOOK:**\n\n${hook.message}`;
  } catch (error) {
    console.error('❌ Manual hook error:', error);
    return `Hook system glitched! Try again! 🎣\n\nTry: "hook morning"`;
  }
}

async function handleHookStats(user) {
  try {
    const stats = await hookService.getUserHookStats(user.id);
    return (
      `📊 **YOUR HOOK STATS** (Last 7 Days)\n\n` +
      `🎣 Hooks Received: ${stats.total_hooks}\n` +
      `✅ Responded To: ${stats.responded_count}\n` +
      `📈 Response Rate: ${stats.response_rate}%\n\n` +
      `The more you respond, the better the hooks get! 🔥\n\n` +
      `Test hooks: "hook morning", "hook evening"`
    );
  } catch (error) {
    console.error('❌ Hook stats error:', error);
    return `Stats system glitched! Try "menu" instead! 📊`;
  }
}

// ✅ ENHANCED: Better invalid option handling
function handleInvalidOption(menu, attempted, validRange) {
  const menuNames = {
    main: 'Main Menu',
    subject: 'Subject Selection',
    math_topics: 'Math Topics',
    friends: 'Friends Menu',
    settings: 'Settings',
    post_answer: 'Next Actions'
  };

  const menuName = menuNames[menu] || 'Menu';
  const range = validRange || '1-5';

  let response = `Invalid choice for ${menuName}! 🚫\n\n`;
  response += `You picked: ${attempted}\n`;
  response += `Valid options: ${range}\n\n`;

  // Add context-specific help
  if (menu === 'math_topics') {
    response += `Pick 1-9 for math topics, or 9 to go back! 🧮`;
  } else if (menu === 'post_answer') {
    response += `Pick 1-5 for your next action! 🎯`;
  } else {
    response += `Try again with a valid number! 🎯`;
  }

  return response;
}

function generateHelpMessage(user) {
  const username = user.username ? `@${user.username}` : 'sharp student';

  return (
    `🤖 **THE GOAT HELP CENTER**\n\n` +
    `Howzit ${username}! Here's what I can do:\n\n` +
    `🎯 **Learning:**\n` +
    `• "next" - Get a practice question\n` +
    `• "report" - See your progress\n` +
    `• "menu" - See all options\n\n` +
    `👥 **Social:**\n` +
    `• "menu" → "4" - Friends & challenges\n` +
    `• Add friends by username\n\n` +
    `⚡ **Quick Commands:**\n` +
    `• A/B/C/D - Answer questions\n` +
    `• Numbers - Navigate menus\n` +
    `• "help" - Show this menu\n\n` +
    `🎣 **Testing:**\n` +
    `• "hook morning" - Test morning hook\n` +
    `• "hook evening" - Test evening hook\n\n` +
    `Ready to dominate? Type "next"! 🔥`
  );
}

function getLevel(questionCount) {
  if (questionCount < 10) return 'Rookie 🥉';
  if (questionCount < 50) return 'Rising Star ⭐';
  if (questionCount < 100) return 'Scholar 📚';
  if (questionCount < 200) return 'Expert 🧠';
  return 'GOAT 🐐';
}
