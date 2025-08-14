/**
 * The GOAT - Complete ManyChat Webhook Handler
 *
 * Architecture: ManyChat (External Request) -> This API Route -> Supabase
 * Features:
 * - Menu-driven numbered interface (Stage A)
 * - Proactive hook system (Stage B)
 * - Username-based friends (no friend codes)
 * - Hybrid static/LLM system
 *
 * Business Rules:
 * - Hook commands take priority (testing)
 * - Registration flow for new users
 * - Question serving with progress tracking
 * - Social features with username lookup
 */

import { createClient } from '@supabase/supabase-js';
import { parseCommand } from './utils/commandParser.js';
import { questionService } from './services/questionService.js';
import { userService, updateUser } from './services/userService.js';
import { menuHandler } from './handlers/menuHandler.js';
import { friendsService } from './services/friendsService.js';
import { hookService } from './services/hookService.js';
import { CONSTANTS, MESSAGES } from './config/constants.js';

// ---------- Environment Helpers ----------
function reqEnv(name, fallback = undefined) {
  const v = process.env[name];
  if (!v && fallback === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v || fallback;
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url)
    throw new Error('Supabase URL env (SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL) is missing.');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY env is missing.');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' }
  });
}

// ---------- ManyChat API Helper ----------
async function sendManyChatReply(psid, message) {
  try {
    console.log(`🔄 Sending to ManyChat PSID: ${psid}`);
    console.log(`📝 Message: ${message}`);
    const token = process.env.MANYCHAT_API_TOKEN;
    if (!token) {
      console.error('❌ FATAL: MANYCHAT_API_TOKEN is not set!');
      return false;
    }

    const url = 'https://api.manychat.com/fb/sending/sendContent';

    const payload = {
      subscriber_id: psid,
      data: {
        version: 'v2',
        content: {
          messages: [
            {
              type: 'text',
              text: message
            }
          ]
        }
      }
    };

    console.log(`🔄 Attempting to send with payload:`, JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log(`📥 API Response Status: ${response.status}`);

    if (response.ok) {
      const responseData = await response.json();
      console.log(`✅ Message sent successfully:`, responseData);
      return true;
    }

    const errorText = await response.text();
    console.error(`❌ ManyChat API failed with status ${response.status}: ${errorText}`);
    return false;
  } catch (error) {
    console.error('❌ Exception in sendManyChatReply:', error);
    return false;
  }
}

// ---------- User Management ----------
async function findOrCreateUser(supabase, subscriberId) {
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('whatsapp_psid', subscriberId)
    .maybeSingle();

  if (error) throw new Error(`User fetch error: ${error.message}`);

  if (user) return user;

  const { data: newUser, error: insertErr } = await supabase
    .from('users')
    .insert({
      whatsapp_psid: subscriberId,
      current_question_id: null,
      correct_answer_rate: 0.5,
      streak_count: 0,
      total_questions_answered: 0,
      last_active_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    })
    .select('*')
    .single();

  if (insertErr) throw new Error(`User insert error: ${insertErr.message}`);
  return newUser;
}

function isUserRegistered(user) {
  return !!(
    user.display_name &&
    user.username &&
    user.grade &&
    user.preferred_subjects?.length > 0
  );
}

// ---------- Registration Flow ----------
function getWelcomeMessage() {
  return MESSAGES.REGISTRATION.WELCOME;
}

async function handleRegistration(user, message) {
  const supabase = getSupabaseClient();
  const input = message.trim();

  try {
    // Step 1: Collect display name
    if (!user.display_name) {
      if (input.toLowerCase() === 'hi') {
        return null; // Let main handler send welcome
      }

      if (input.length < 2 || input.length > 50) {
        return {
          reply: `Name should be 2-50 characters! Try again:\n\nWhat should I call you? 😊`
        };
      }

      await updateUser(user.id, { display_name: input });
      return {
        reply: MESSAGES.REGISTRATION.USERNAME_PROMPT
      };
    }

    // Step 2: Collect username
    if (!user.username) {
      const cleanUsername = input.toLowerCase().replace(/[^a-z0-9_]/g, '');

      if (cleanUsername.length < 3 || cleanUsername.length > 20) {
        return {
          reply: `Username must be 3-20 characters (letters, numbers, underscore only)!\n\nTry again: 🔤`
        };
      }

      // Check if username exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (existingUser) {
        return {
          reply: `Username @${cleanUsername} is taken! 😅\n\nTry another username:`
        };
      }

      await updateUser(user.id, { username: cleanUsername });
      return {
        reply: MESSAGES.REGISTRATION.GRADE_PROMPT
      };
    }

    // Step 3: Collect grade
    if (!user.grade) {
      const validGrades = ['8', '9', '10', '11', '12', 'varsity'];
      const grade = input.toLowerCase();

      if (!validGrades.includes(grade)) {
        return {
          reply: `Please choose from: 8, 9, 10, 11, 12, or varsity 📚\n\nWhat grade are you in?`
        };
      }

      await updateUser(user.id, { grade: grade });
      return {
        reply: MESSAGES.REGISTRATION.SUBJECTS_PROMPT
      };
    }

    // Step 4: Collect subjects
    if (!user.preferred_subjects || user.preferred_subjects.length === 0) {
      const availableSubjects = ['math', 'physics', 'life sciences', 'chemistry'];
      const inputSubjects = input
        .toLowerCase()
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      // Map common variations
      const subjectMap = {
        mathematics: 'math',
        maths: 'math',
        'life science': 'life sciences',
        chemistry: 'chemistry',
        physics: 'physics'
      };

      const selectedSubjects = inputSubjects
        .map((s) => subjectMap[s] || s)
        .filter((s) => availableSubjects.includes(s));

      if (selectedSubjects.length === 0) {
        return {
          reply: `Please choose from: math, physics, life sciences, chemistry\n\nExample: math, physics 📚`
        };
      }

      await updateUser(user.id, {
        preferred_subjects: selectedSubjects,
        last_active_at: new Date().toISOString()
      });

      const subjectNames = selectedSubjects
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(', ');

      return {
        reply: `Lekker! Ready to dominate ${subjectNames}! 💪\n\n${MESSAGES.REGISTRATION.COMPLETE_ONBOARDING}`
      };
    }

    return null; // Registration complete
  } catch (error) {
    console.error('❌ Registration error:', error);
    return {
      reply: `Registration glitched! Let's start over:\n\nWhat should I call you? 😊`
    };
  }
}

// ---------- Command Handlers ----------
async function handleQuestionCommand(user, command) {
  try {
    console.log(`🎯 Handling question request for user ${user.id}`);

    const question = await questionService.getNextQuestion(user.id);

    if (!question) {
      return `No questions available for your subjects right now! 📚\n\nTry "menu" → "2" to switch subjects!`;
    }

    // Serve question to user
    await questionService.serveQuestionToUser(user.id, question.id);

    const formattedQuestion = questionService.formatQuestionText(question);

    console.log(`✅ Question ${question.id} served to user ${user.id}`);
    return formattedQuestion;
  } catch (error) {
    console.error('❌ Question command error:', error);
    return `Eish, couldn't get a question right now. Try again in a moment! 🎯`;
  }
}

async function handleAnswerCommand(user, command) {
  try {
    console.log(`✅ Processing answer: ${command.value} for user ${user.id}`);

    if (!user.current_question_id) {
      return `No question to answer! Type "menu" → "1" to get a fresh question! 🎯`;
    }

    // Get current question
    const { data: question } = await getSupabaseClient()
      .from('mcqs')
      .select('*')
      .eq('id', user.current_question_id)
      .single();

    if (!question) {
      await updateUser(user.id, { current_question_id: null });
      return `Question expired! Type "menu" → "1" for a new one! 🔄`;
    }

    const userAnswer = command.value;
    const correctAnswer = question.correct_choice?.toUpperCase();
    const isCorrect = userAnswer === correctAnswer;

    // Record the response
    const responseContext = await questionService.recordUserResponse(
      user.id,
      question.id,
      userAnswer,
      isCorrect
    );

    // Update user stats
    const newRate = updateRate(user.correct_answer_rate ?? 0.5, isCorrect);
    const newStreak = isCorrect ? (user.streak_count || 0) + 1 : 0;
    const newTotal = (user.total_questions_answered || 0) + 1;

    await updateUser(user.id, {
      current_question_id: null,
      correct_answer_rate: newRate,
      streak_count: newStreak,
      total_questions_answered: newTotal,
      last_active_at: new Date().toISOString()
    });

    // Generate response message
    if (isCorrect) {
      const streak = newStreak;
      const vibe = streak >= 5 ? '🔥🔥🔥' : streak >= 3 ? '🔥🔥' : '🔥';
      return `💯 Howzit sharp shooter! You nailed it! ${vibe}\nStreak: ${streak} 🔥\n\nType "menu" → "1" for another question! 🚀`;
    } else {
      // Log weakness if answer was wrong
      if (responseContext.topicId) {
        await questionService.logWeakness(
          user.id,
          question.id,
          userAnswer,
          responseContext.topicId,
          responseContext.subjectId
        );
      }

      return `Aweh, not this time. Correct answer was ${correctAnswer}. No stress! 💪\n\nType "menu" → "1" to bounce back! 🎯`;
    }
  } catch (error) {
    console.error('❌ Answer command error:', error);
    return `Answer processing glitched! Try "menu" → "1" for a new question! 🔄`;
  }
}

async function handleSubjectSwitchCommand(user, command) {
  try {
    const targetSubject = command.target;
    const subjectName = command.subject_name;

    // Verify user has this subject
    if (!user.preferred_subjects?.includes(targetSubject)) {
      const userSubjects = user.preferred_subjects?.join(', ') || 'none';
      return `Eish, you're not registered for ${subjectName}! 📚\n\nYour subjects: ${userSubjects}\n\nType "menu" for options!`;
    }

    // Clear current question and switch subject context
    await updateUser(user.id, {
      current_question_id: null,
      current_subject: targetSubject,
      last_active_at: new Date().toISOString()
    });

    // Immediately serve a question from the new subject
    const question = await questionService.getNextQuestion(user.id, targetSubject);

    if (!question) {
      return `🔄 Switched to ${subjectName}!\n\nNo questions available right now. Try again later! 📚`;
    }

    await questionService.serveQuestionToUser(user.id, question.id);
    const formattedQuestion = questionService.formatQuestionText(question);

    return `🔄 Switched to ${subjectName}!\n\n${formattedQuestion}`;
  } catch (error) {
    console.error('❌ Subject switch error:', error);
    return `Subject switch glitched! Try "menu" → "2" again! 🔄`;
  }
}

async function handleReportCommand(user) {
  try {
    const total = user.total_questions_answered || 0;
    const rate = user.correct_answer_rate || 0;
    const streak = user.streak_count || 0;
    const percentage = Math.round(rate * 100);

    // Determine level based on questions answered
    let level = 'Rookie';
    if (total >= 100) level = 'Legend';
    else if (total >= 50) level = 'Master';
    else if (total >= 25) level = 'Expert';
    else if (total >= 10) level = 'Rising Star';

    const subjects = user.preferred_subjects?.join(', ') || 'None';

    return (
      `🏆 YOUR PROGRESS REPORT\n\n` +
      `📈 Overall Stats:\n` +
      `- Questions answered: ${total}\n` +
      `- Accuracy rate: ${percentage}%\n` +
      `- Current streak: ${streak}\n` +
      `- Level: ${level}\n` +
      `- Subjects: ${subjects}\n\n` +
      `Keep pushing forward! Type "menu" → "1" for another question 🔥`
    );
  } catch (error) {
    console.error('❌ Report command error:', error);
    return `Report system glitched! Try "menu" instead! 📊`;
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
  return (
    `🤖 THE GOAT HELP CENTER\n\n` +
    `Howzit @${user.username || 'champion'}! Here's what I can do:\n\n` +
    `🎯 Learning:\n` +
    `• Type "menu" - See all options\n` +
    `• "1" (from menu) - Get practice question\n` +
    `• "3" (from menu) - See your progress\n\n` +
    `👥 Social:\n` +
    `• "4" (from menu) - Friends & challenges\n` +
    `• Add friends by username\n\n` +
    `⚡ Quick Commands:\n` +
    `• A/B/C/D - Answer questions\n` +
    `• "next" - Quick question (bypass menu)\n\n` +
    `🎣 Testing:\n` +
    `• "hook morning" - Test morning hook\n` +
    `• "hook evening" - Test evening hook\n\n` +
    `Ready to dominate? Type "menu"! 🔥`
  );
}

// ---------- Utility Functions ----------
function updateRate(oldRate, isCorrect) {
  return (oldRate * 4 + (isCorrect ? 1 : 0)) / 5;
}

function formatResponse(reply, metadata = {}) {
  return {
    status: 'success',
    message: reply,
    ...metadata
  };
}

// ---------- Main Handler ----------
export default async function handler(req, res) {
  const start = Date.now();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', allowed: ['POST'] });
  }

  const subscriberId = req.body.subscriber_id || req.body.psid;
  const message = req.body.message;

  if (!subscriberId || !message) {
    return res.status(400).json({ error: 'Missing subscriber_id/psid or message' });
  }

  console.log(`📥 Webhook request from ${subscriberId}: "${message}"`);

  let reply = '';
  let replySent = false;

  try {
    const supabase = getSupabaseClient();
    const user = await findOrCreateUser(supabase, subscriberId);

    console.log(`👤 User ${user.id} (${user.display_name || 'unregistered'})`);

    const isRegistered = isUserRegistered(user);

    // Parse command with context
    const command = parseCommand(message, {
      current_menu: user.current_menu,
      expecting_username: user.expecting_input === 'username_for_friend',
      expecting_challenge_username: user.expecting_input === 'username_for_challenge',
      expecting_registration_input: !isRegistered && user.display_name
    });

    console.log(`🎯 Command: ${command.type} - ${command.action || 'none'}`);

    // PRIORITY 1: HANDLE HOOK COMMANDS FIRST (before registration check)
    if (command.type === 'manual_hook') {
      reply = await handleManualHook(user, command);
      await sendManyChatReply(subscriberId, reply);
      replySent = true;

      return res.status(200).json(
        formatResponse(reply, {
          subscriber_id: subscriberId,
          elapsed_ms: Date.now() - start,
          command_type: command.type
        })
      );
    }

    if (command.type === 'hook_stats') {
      reply = await handleHookStats(user);
      await sendManyChatReply(subscriberId, reply);
      replySent = true;

      return res.status(200).json(
        formatResponse(reply, {
          subscriber_id: subscriberId,
          elapsed_ms: Date.now() - start,
          command_type: command.type
        })
      );
    }

    // PRIORITY 2: REGISTRATION FLOW (for unregistered users)
    if (!isRegistered) {
      console.log(`📝 User ${user.id} needs registration`);

      // Handle welcome for brand new users
      if (!user.display_name && message.toLowerCase().trim() === 'hi') {
        reply = getWelcomeMessage();
        await sendManyChatReply(subscriberId, reply);
        replySent = true;

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
        reply = registrationResult.reply;
        await sendManyChatReply(subscriberId, reply);
        replySent = true;

        return res.status(200).json(
          formatResponse(reply, {
            subscriber_id: subscriberId,
            elapsed_ms: Date.now() - start,
            registration_step: true
          })
        );
      }
    }

    // PRIORITY 3: COMMAND HANDLING (for registered users)
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

      case 'subject_switch':
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

      case 'unknown_command':
        reply = await menuHandler.showMainMenu(user);
        break;

      default:
        reply = await menuHandler.showMainMenu(user);
    }

    await sendManyChatReply(subscriberId, reply);
    replySent = true;
  } catch (err) {
    console.error('Webhook processing error:', {
      message: err.message,
      stack: err.stack
    });

    if (!replySent) {
      try {
        await sendManyChatReply(
          subscriberId,
          `Eish, something glitched on my side. Give it a sec then try "menu" again. 🙏`
        );
      } catch (inner) {
        console.error('Failed to send fallback reply:', inner.message);
      }
    }
  } finally {
    res.status(200).json({
      status: 'success',
      elapsed_ms: Date.now() - start
    });
  }
}
