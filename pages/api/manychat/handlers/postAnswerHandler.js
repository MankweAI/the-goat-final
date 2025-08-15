/**
 * Post-Answer Experience Handler (Corrected)
 * Provides comprehensive feedback, progress tracking, and a structured, numbered menu for next actions.
 */

import { updateUser } from '../services/userService.js';
import { aiService } from '../services/aiService.js';
import { formatStreak, formatPercentage, formatTopicName } from '../utils/responseFormatter.js';
import { menuHandler } from './menuHandler.js'; // For showing menus
import { handleQuestionRequest } from './questionHandler.js'; // For getting next question

/**
 * Main function to handle the action selected from the post-answer menu.
 * @param {object} user - The user object.
 * @param {number} actionNumber - The number the user selected (1-5).
 * @returns {string} The reply message for the user.
 */
export async function handlePostAnswerAction(user, actionNumber) {
  try {
    console.log(`🎯 Post-answer action ${actionNumber} selected by user ${user.id}`);

    // This logic is based on the new, dynamic menu presented to the user.
    // We will map the numbers to specific actions.
    switch (actionNumber) {
      case 1: // Next Question (in the same topic)
        return await handleQuestionRequest(user, { action: 'next' });
      case 2: // Switch Topic/Subject
        return await menuHandler.showSubjectMenu(user);
      case 3: // Challenge a Friend or Review Concepts
        return await menuHandler.showFriendsMenu(user); // Simplified to Friends Menu
      case 4: // Progress Report
        return await handleReportCommand(user); // Assuming handleReportCommand exists in index.js
      case 5: // Main Menu
        return await menuHandler.showMainMenu(user);
      default:
        return `Invalid choice! Pick a number 1-5 from the options above! 🎯`;
    }
  } catch (error) {
    console.error(`❌ Post-answer action error:`, error);
    return `Eish, couldn't process that action. Try "menu" to restart! 🔄`;
  }
}

/**
 * Generates the complete post-answer response, including feedback and the crucial numbered menu.
 * @param {object} user - The user object.
 * @param {object} question - The question that was answered.
 * @param {object} answerResult - An object containing details about the answer.
 * @returns {string} The complete message to be sent to the user.
 */
export async function generatePostAnswerResponse(user, question, answerResult) {
  try {
    const { isCorrect, newStreak, stats } = answerResult;

    console.log(`📊 Generating post-answer response for user ${user.id}: Correct=${isCorrect}`);

    // CRITICAL: Set the user's menu state so the parser knows to expect a numbered reply (1-5).
    await updateUser(user.id, {
      current_menu: 'post_answer',
      last_active_at: new Date().toISOString()
    });

    const feedback = isCorrect
      ? generateCorrectResponse(newStreak, stats, question)
      : generateIncorrectResponse(answerResult, question);

    // This is the numbered menu for what to do next.
    const nextActionsMenu =
      `\n\n**What's next?**\n\n` +
      `1️⃣ Next Question\n` +
      `2️⃣ Change Subject\n` +
      `3️⃣ See My Report\n` +
      `4️⃣ Friends & Challenges\n` +
      `5️⃣ Main Menu\n\n` +
      `Type the number! 💪`;

    return feedback + nextActionsMenu;
  } catch (error) {
    console.error(`❌ Post-answer response generation failed:`, error);
    return `Eish, something went wrong. Type "next" for a new question!`;
  }
}

/**
 * Generates the feedback text for a correct answer.
 */
function generateCorrectResponse(newStreak, stats, question) {
  const streakEmoji = formatStreak(newStreak);
  const topicName = formatTopicName(question.topics?.display_name);

  let response = `💯 Sharp! You nailed it! ${streakEmoji}\n`;
  if (newStreak > 1) {
    response += `That's a **${newStreak}-question streak**!\n\n`;
  }
  response += `📈 **${topicName} Accuracy:** ${formatPercentage(stats.accuracy)}%`;
  return response;
}

/**
 * Generates the feedback text for an incorrect answer.
 */
function generateIncorrectResponse(answerResult, question) {
  const { correctAnswer, stats, streakLost } = answerResult;
  const topicName = formatTopicName(question.topics?.display_name);

  let response = `Aweh, not this time. The correct answer was **${correctAnswer}**.`;
  if (streakLost > 1) {
    response += `\nYour streak of ${streakLost} is over, but you can start a new one now!`;
  }
  response += `\n\n📈 **${topicName} Accuracy:** ${formatPercentage(stats.accuracy)}%`;
  return response;
}

// A placeholder for a report command function, assuming it would be moved or imported.
async function handleReportCommand(user) {
  const totalQuestions = user.total_questions_answered || 0;
  const correctAnswers = user.total_correct_answers || 0;
  const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  return `📊 **Progress Report**\n- Questions Answered: ${totalQuestions}\n- Accuracy: ${accuracy}%`;
}
