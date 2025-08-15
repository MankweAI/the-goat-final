/**
 * Post-Answer Experience Handler (Fixed)
 * Date: 2025-08-15 17:13:45 UTC
 */

import { updateUser } from '../services/userService.js';
import { formatStreak, formatPercentage, formatTopicName } from '../utils/responseFormatter.js';
import { menuHandler } from './menuHandler.js';
import { handleQuestionRequest } from './questionHandler.js';

export async function handlePostAnswerAction(user, actionNumber) {
  try {
    console.log(`🎯 Post-answer action ${actionNumber} selected by user ${user.id}`);

    switch (actionNumber) {
      case 1: // Next Question
        return await handleQuestionRequest(user, { action: 'next' });
      case 2: // Switch Topic/Subject
        return await menuHandler.showSubjectMenu(user);
      case 3: // Challenge a Friend
        return await menuHandler.showFriendsMenu(user);
      case 4: // Progress Report
        return await generateProgressReport(user);
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

async function generateProgressReport(user) {
  try {
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
    console.error(`❌ Progress report error:`, error);
    return `Eish, couldn't load your report right now. Try again in a bit! 📊`;
  }
}

function getLevel(questionCount) {
  if (questionCount < 10) return 'Rookie 🥉';
  if (questionCount < 50) return 'Rising Star ⭐';
  if (questionCount < 100) return 'Scholar 📚';
  if (questionCount < 200) return 'Expert 🧠';
  return 'GOAT 🐐';
}

export async function generatePostAnswerResponse(user, question, answerResult) {
  try {
    const { isCorrect, newStreak, stats } = answerResult;

    console.log(`📊 Generating post-answer response for user ${user.id}: Correct=${isCorrect}`);

    await updateUser(user.id, {
      current_menu: 'post_answer',
      last_active_at: new Date().toISOString()
    });

    const feedback = isCorrect
      ? generateCorrectResponse(newStreak, stats, question)
      : generateIncorrectResponse(answerResult, question);

    const nextActionsMenu =
      `\n\n**What's next?**\n\n` +
      `1️⃣ Next Question\n` +
      `2️⃣ Change Subject\n` +
      `3️⃣ Challenge Friend\n` +
      `4️⃣ Progress Report\n` +
      `5️⃣ Main Menu\n\n` +
      `Type the number! 💪`;

    return feedback + nextActionsMenu;
  } catch (error) {
    console.error(`❌ Post-answer response generation failed:`, error);
    return `Eish, something went wrong. Type "next" for a new question!`;
  }
}

function generateCorrectResponse(newStreak, stats, question) {
  try {
    const streakEmoji = formatStreak(newStreak);
    const topicName = formatTopicName(question.topics?.display_name);

    let response = `💯 Sharp! You nailed it! ${streakEmoji}\n`;
    if (newStreak > 1) {
      response += `That's a **${newStreak}-question streak**!\n\n`;
    }
    response += `📈 **${topicName} Accuracy:** ${formatPercentage(stats.accuracy)}%`;
    return response;
  } catch (error) {
    console.error(`❌ generateCorrectResponse error:`, error);
    return `💯 Correct! 🔥`;
  }
}

function generateIncorrectResponse(answerResult, question) {
  try {
    const { correctAnswer, stats, streakLost } = answerResult;
    const topicName = formatTopicName(question.topics?.display_name);

    let response = `Aweh, not this time. The correct answer was **${correctAnswer}**.`;
    if (streakLost > 1) {
      response += `\nYour streak of ${streakLost} is over, but you can start a new one now!`;
    }
    response += `\n\n📈 **${topicName} Accuracy:** ${formatPercentage(stats.accuracy)}%`;
    return response;
  } catch (error) {
    console.error(`❌ generateIncorrectResponse error:`, error);
    return `Not quite! Try again! 💪`;
  }
}
