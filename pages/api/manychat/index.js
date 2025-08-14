/**
 * The GOAT - ManyChat Webhook (WhatsApp channel)
 * Architecture: ManyChat (External Request) -> This API Route -> Supabase
 *
 * Modular Backend with GPT-Enhanced Explanations
 */

import {
  findOrCreateUser,
  isUserRegistrationComplete,
  updateUserActivity
} from './services/userService.js';
import { menuHandler } from './handlers/menuHandler.js';
import { friendsService } from './services/friendsService.js';
import { handleRegistration, getWelcomeMessage } from './handlers/registrationHandler.js';
import { handleQuestionRequest, handleSubjectSwitch } from './handlers/questionHandler.js';
import { handleAnswerSubmission } from './handlers/answerHandler.js';
import { parseCommand } from './utils/commandParser.js';
import { formatResponse, formatErrorResponse } from './utils/responseFormatter.js';
import { aiService } from './services/aiService.js';
import { CONSTANTS } from './config/constants.js';

export default async function handler(req, res) {
  const start = Date.now();

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json(
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
    return res
      .status(400)
      .json(
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

    if (!isRegistered) {
      console.log(`📝 User ${user.id} needs registration`);

      // Handle welcome for brand new users
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

      // Handle registration flow
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

    // Parse user command
const command = parseCommand(message, {
  current_menu: user.current_menu,
  expecting_username: user.expecting_input === 'username_for_friend',
  expecting_challenge_username: user.expecting_input === 'username_for_challenge',
  expecting_registration_input: !isRegistered && user.display_name // User in registration flow
});

console.log(`🎯 Command: ${command.type} - ${command.action}`);

    // Handle different command types
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

  case CONSTANTS.COMMAND_TYPES.REPORT:
    reply = await handleReportCommand(user);
    break;

  case CONSTANTS.COMMAND_TYPES.FRIENDS:
    reply = await handleFriendsCommand(user, command);
    break;

  case 'invalid_option':
    reply = menuHandler.handleInvalidOption(command.menu);
    break;

  case CONSTANTS.COMMAND_TYPES.HELP:
    reply = generateHelpMessage(user);
    break;
  case 'manual_hook':
    reply = await handleManualHook(user, command);
    break;

  case 'hook_stats':
    reply = await handleHookStats(user);
    break;

  default:
    reply = await menuHandler.showMainMenu(user);
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
            // Clear expecting input
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
          return `Valid hook types: ${validTypes.join(', ')}\n\nExample: "hook morning"`;
        }

        const hook = await hookService.getHookForUser(user.id, `${hookType}_hook`);

        if (!hook) {
          return `No ${hookType} hook available right now! 🎣`;
        }

        return `🎣 ${hookType.toUpperCase()} HOOK:\n\n${hook.message}`;
      } catch (error) {
        console.error('❌ Manual hook error:', error);
        return `Hook system glitched! Try again! 🎣`;
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
          `The more you respond, the better the hooks get! 🔥`
        );
      } catch (error) {
        console.error('❌ Hook stats error:', error);
        return `Stats system glitched! Try "menu" instead! 📊`;
      }
    }
    // Log GPT usage stats
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
// COMMAND HANDLER FUNCTIONS
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

async function handleSubjectSwitchCommand(user, command) {
  try {
    return await handleSubjectSwitch(user, command.target);
  } catch (error) {
    console.error('❌ Subject switch error:', error);
    return `Couldn't switch subjects right now. Type "next" for a question! 🔄`;
  }
}

async function handleReportCommand(user) {
  try {
    // Placeholder for Stage 4 - Progress Reports
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
    // Placeholder for Stage 5 - Social Features
    switch (command.action) {
      case 'list':
        return `👥 Friends feature coming soon! You'll be able to connect with study buddies! 🤝`;
      case 'show_code':
        return `🔗 Your friend code: **${user.friend_code || 'Coming soon!'}**\n\nShare this with friends to connect! 👥`;
      case 'add':
        return `🤝 Friend adding coming soon! Save that code: ${command.target}`;
      default:
        return `👥 Friends feature coming soon! Type "help" for current features! 🤝`;
    }
  } catch (error) {
    console.error('❌ Friends command error:', error);
    return `Friends feature coming soon! Type "next" for a question! 👥`;
  }
}

async function handleChallengeCommand(user, command) {
  try {
    // Placeholder for Stage 6 - Challenge System
    return `⚔️ Challenge feature coming soon! You'll be able to battle friends with questions! 🔥\n\nType "next" to keep practicing!`;
  } catch (error) {
    console.error('❌ Challenge command error:', error);
    return `Challenge feature coming soon! Type "next" for a question! ⚔️`;
  }
}

function generateHelpMessage(user) {
  const username = user.username ? `@${user.username}` : 'sharp student';

  return `🤖 THE GOAT HELP CENTER\n\nHowzit ${username}! Here's what I can do:\n\n🎯 **Learning:**\n• "next" - Get a practice question\n• "report" - See your progress\n• "switch to [subject]" - Change subject\n\n👥 **Social:** (Coming Soon)\n• "add friend [code]" - Add a study buddy\n• "my friends" - See your squad\n• "challenge @username" - Battle a friend\n\n⚡ **Quick Commands:**\n• "help" - Show this menu\n• A/B/C/D - Answer questions\n\nReady to dominate? Type "next"! 🔥`;
}

function getLevel(questionCount) {
  if (questionCount < 10) return 'Rookie 🥉';
  if (questionCount < 50) return 'Rising Star ⭐';
  if (questionCount < 100) return 'Scholar 📚';
  if (questionCount < 200) return 'Expert 🧠';
  return 'GOAT 🐐';
}
