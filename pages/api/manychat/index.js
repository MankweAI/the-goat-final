/**
 * The GOAT - Complete ManyChat Webhook Handler (Updated)
 *
 * Architecture: ManyChat (External Request) -> This API Route -> Supabase
 * Update: Integrated post-answer action handling and corrected imports.
 */

// ========== CORRECTED IMPORTS ==========
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
import { handleQuestionRequest, handleSubjectSwitch } from './handlers/questionHandler.js';
import { handleAnswerSubmission } from './handlers/answerHandler.js';
import { parseCommand } from './utils/commandParser.js';
import { formatResponse, formatErrorResponse } from './utils/responseFormatter.js';
import { aiService } from './services/aiService.js';
import { CONSTANTS } from './config/constants.js';
// NEW: Import for the post-answer handler
import { handlePostAnswerAction } from './handlers/postAnswerHandler.js';

// ========== MAIN HANDLER ==========
export default async function handler(req, res) {
  const start = Date.now();

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

  // Log incoming request
  console.log(`📥 Webhook request from ${subscriberId}: "${message}"`);

  // Validate WhatsApp subscriber ID format
  if (!/^\d+$/.test(String(subscriberId))) {
    console.warn(`⚠️  Non-numeric subscriberId: ${subscriberId}`);
  }

  try {
    // Find or create user
    const user = await findOrCreateUser(subscriberId);
    console.log(`👤 User ${user.id} (${user.username || 'unregistered'})`);

    // Update user activity
    await updateUserActivity(user.id);

    // Check if user needs to complete registration
    const isRegistered = await isUserRegistrationComplete(user);

    // Parse command with context FIRST (before registration check)
    const command = parseCommand(message, {
      current_menu: user.current_menu,
      expecting_username: user.expecting_input === 'username_for_friend',
      expecting_challenge_username: user.expecting_input === 'username_for_challenge',
      expecting_registration_input: !isRegistered && user.display_name,
      has_current_question: !!user.current_question_id,
      expecting_answer: !!user.current_question_id
    });
    console.log(`🎯 Command: ${command.type} - ${command.action || 'none'}`);

    // PRIORITY 1: HANDLE INVALID ANSWERS
    if (command.type === 'invalid_answer') {
      const reply = command.error;
      return res.status(200).json(
        formatResponse(reply, {
          subscriber_id: subscriberId,
          elapsed_ms: Date.now() - start,
          command_type: command.type,
          error: 'invalid_answer_format'
        })
      );
    }

    // PRIORITY 1: HANDLE HOOK COMMANDS FIRST
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

    // PRIORITY 2: REGISTRATION FLOW
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

    // PRIORITY 3: COMMAND HANDLING
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
        reply = await handleAnswerCommand(user, command);
        break;
      case CONSTANTS.COMMAND_TYPES.SUBJECT_SWITCH:
        reply = await handleSubjectSwitchCommand(user, command);
        break;
      case 'math_topic_select':
        reply = await handleMathTopicSelection(user, command.topicNumber);
        break;
      case CONSTANTS.COMMAND_TYPES.REPORT:
        reply = await handleReportCommand(user);
        break;
      case CONSTANTS.COMMAND_TYPES.FRIENDS:
        reply = await handleFriendsCommand(user, command);
        break;

      // NEW: Post-answer action handler
      case 'post_answer_action':
        reply = await handlePostAnswerAction(user, command.actionNumber);
        break;

      // UPDATED: Invalid option handler with post-answer context
      case 'invalid_option':
        if (command.menu === 'post_answer') {
          reply =
            `Invalid choice for next actions! 🚫\n\n` +
            `You picked: ${command.attempted}\n` +
            `Valid options: 1-5\n\n` +
            `Pick a number 1-5 from the menu above! 🎯`;
        } else {
          reply = handleInvalidOption(command.menu, command.attempted, command.validRange);
        }
        break;

      case CONSTANTS.COMMAND_TYPES.HELP:
        reply = generateHelpMessage(user);
        break;
      default:
        console.log(`⚠️ Unhandled command type: ${command.type}`);
        reply = await menuHandler.showMainMenu(user);
    }

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
      return (
        `Invalid choice for ${menuName}! 🚫\n\n` +
        `You picked: ${attempted}\n` +
        `Valid options: ${validRange}\n\n` +
        `Try again with a valid number! 🎯`
      );
    }

    const gptStats = aiService.getUsageStats();
    console.log(
      `🤖 GPT Stats: ${gptStats.requestCount} requests, ~$${gptStats.estimatedCost.toFixed(3)} cost`
    );
    console.log(
      `✅ Response generated: ${reply.substring(0, 100)}${reply.length > 100 ? '...' : ''}`
    );

    return res.status(200).json(
      formatResponse(reply, {
        subscriber_id: subscriberId,
        elapsed_ms: Date.now() - start,
        command_type: command.type,
        gpt_requests: gptStats.requestCount
      })
    );
  } catch (error) {
    console.error('💥 Webhook processing error:', {
      message: error.message,
      stack: error.stack,
      subscriberId,
      inputMessage: message
    });
    return res.status(200).json(
      formatErrorResponse(error, {
        subscriber_id: subscriberId,
        elapsed_ms: Date.now() - start
      })
    );
  }
}

// ===============================
// COMMAND HANDLER FUNCTIONS (Unchanged)
// ===============================

async function handleQuestionCommand(user, command) {
  try {
    if (command.action === 'next') {
      return await handleQuestionRequest(user, command);
    }
    return `Type "next" for a question! 🎯`;
  } catch (error) {
    console.error('❌ Question command error:', error);
    return `Eish, couldn't get a question right now. Try again in a moment! 🎯`;
  }
}

async function handleAnswerCommand(user, command) {
  try {
    return await handleAnswerSubmission(user, command);
  } catch (error) {
    console.error('❌ Answer command error:', error);
    return `Eish, couldn't process your answer. Try "next" for a fresh question! 📝`;
  }
}

async function handleReportCommand(user) {
  try {
    const totalQuestions = user.total_questions_answered || 0;
    const correctAnswers = user.total_correct_answers || 0;
    const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    const streak = user.streak_count || 0;
    let report = `🏆 YOUR PROGRESS REPORT\n\n`;
    report += `📈 Overall Stats:\n`;
    report += `- Questions answered: ${totalQuestions}\n`;
    report += `- Accuracy rate: ${accuracy}%\n`;
    report += `- Current streak: ${streak}\n`;
    report += `- Level: ${getLevel(totalQuestions)}\n\n`;
    report += `Keep pushing forward! Type "next" for another question 🔥`;
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
        return await menuHandler.promptAddFriend(user);
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
      return `🎣 HOOK TESTER\n\nValid types: ${validTypes.join(', ')}\n\nExample: "hook morning"`;
    }
    const hook = await hookService.getHookForUser(user.id, `${hookType}_hook`);
    if (!hook) {
      return `No ${hookType} hook available right now! 🎣\n\nTry: "hook morning" or "hook evening"`;
    }
    return `🎣 ${hookType.toUpperCase()} HOOK:\n\n${hook.message}`;
  } catch (error) {
    console.error('❌ Manual hook error:', error);
    return `Hook system glitched! Try again! 🎣\n\nTry: "hook morning"`;
  }
}

async function handleHookStats(user) {
  try {
    const stats = await hookService.getUserHookStats(user.id);
    return (
      `📊 YOUR HOOK STATS (Last 7 Days)\n\n` +
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

function generateHelpMessage(user) {
  const username = user.username ? `@${user.username}` : 'sharp student';
  return `🤖 THE GOAT HELP CENTER\n\nHowzit ${username}! Here's what I can do:\n\n🎯 **Learning:**\n• "next" - Get a practice question\n• "report" - See your progress\n• "menu" - See all options\n\n👥 **Social:**\n• "menu" → "4" - Friends & challenges\n• Add friends by username\n\n⚡ **Quick Commands:**\n• A/B/C/D - Answer questions\n• "help" - Show this menu\n\n🎣 **Testing:**\n• "hook morning" - Test morning hook\n• "hook evening" - Test evening hook\n\nReady to dominate? Type "next"! 🔥`;
}

function getLevel(questionCount) {
  if (questionCount < 10) return 'Rookie 🥉';
  if (questionCount < 50) return 'Rising Star ⭐';
  if (questionCount < 100) return 'Scholar 📚';
  if (questionCount < 200) return 'Expert 🧠';
  return 'GOAT 🐐';
}
