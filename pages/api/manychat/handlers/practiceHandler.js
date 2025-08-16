/**
 * Practice Handler - Direct Question Practice
 * Date: 2025-08-16 17:03:51 UTC
 * Flow: Immediate question → Answer → Detailed feedback → Continue menu
 */

import { executeQuery } from '../config/database.js';
import { updateUser } from '../services/userService.js';
import { questionService } from '../services/questionService.js';
import { formatQuestion } from '../utils/questionFormatter.js';
import { CONSTANTS, MESSAGES } from '../config/constants.js';

export const practiceHandler = {
  // Entry point - immediate practice
  async startPractice(user) {
    console.log(`🎯 Starting practice for user ${user.id}`);

    // Get a question immediately (no intake needed)
    const question = await questionService.getRandomQuestion(user, {
      subject: 'math',
      difficulty: calculateUserDifficulty(user),
      excludeRecent: true
    });

    if (!question) {
      return (
        `No practice questions available right now.\n\n` +
        `Try again in a moment, or type "menu" for other options. 🌱`
      );
    }

    await questionService.serveQuestionToUser(user.id, question.id);
    await updateUser(user.id, {
      current_menu: 'practice_active',
      last_active_at: new Date().toISOString()
    });

    const topicName = question.topics?.display_name || 'Mathematics';
    const difficultyEmoji = getDifficultyEmoji(question.difficulty);

    return (
      `🧮 ${topicName} Practice ${difficultyEmoji}\n\n` +
      `${formatQuestion(question)}\n\n` +
      `Send A, B, C, or D! 🎯`
    );
  },

  // Handle practice answers with detailed feedback
  async handlePracticeAnswer(user, answerLetter) {
    console.log(`📝 Practice answer from user ${user.id}: ${answerLetter}`);

    if (!user.current_question_id) {
      return `No active practice question. Type "practice" to start! 🧮`;
    }

    // Get current question and check answer
    const { question, correct, correctChoice } = await fetchQuestionAndCheck(
      user.current_question_id,
      answerLetter
    );

    // Record response and update stats
    await questionService.recordUserResponse(user.id, question.id, answerLetter, correct, null);

    const { newStreak, stats } = await updateUserStats(user.id, correct);

    // Clear current question
    await updateUser(user.id, {
      current_question_id: null,
      current_menu: 'practice_continue'
    });

    // Generate detailed feedback
    const feedback = await generateDetailedFeedback(
      user,
      question,
      correct,
      correctChoice,
      newStreak,
      stats
    );

    return `${feedback}\n\n${MESSAGES.PRACTICE.CONTINUE_MENU}`;
  },

  // Handle practice continue menu
  async handlePracticeContinue(user, action) {
    console.log(`🔄 Practice continue: ${action} for user ${user.id}`);

    if (action === 'continue') {
      return await this.startPractice(user);
    }

    if (action === 'switch_topic') {
      return await this.switchTopic(user);
    }

    if (action === 'short_break') {
      await updateUser(user.id, { current_menu: 'welcome' });
      return (
        `Take your time. Breathe.\n\n` +
        `You're building knowledge step by step. 🌱\n\n` +
        `Type "practice" when ready to continue.`
      );
    }

    if (action === 'remind_tonight') {
      await createPracticeReminder(user.id);
      await updateUser(user.id, { current_menu: 'welcome' });
      return (
        `I'll remind you to practice tonight. 🌙\n\n` +
        `Keep building that knowledge. You're doing great.`
      );
    }

    return `Pick 1, 2, 3, or 4 from the menu above. ✨`;
  },

  // Switch topic (simplified for MVP)
  async switchTopic(user) {
    // For MVP, just get a question from a different topic area
    const question = await questionService.getRandomQuestion(user, {
      subject: 'math',
      difficulty: calculateUserDifficulty(user),
      excludeRecent: true
    });

    if (!question) {
      return `Let's stick with your current topic for now.\n\n` + `Type "practice" to continue! 🧮`;
    }

    await questionService.serveQuestionToUser(user.id, question.id);
    await updateUser(user.id, { current_menu: 'practice_active' });

    const topicName = question.topics?.display_name || 'Mathematics';

    return (
      `🔄 Switched to ${topicName}!\n\n` +
      `${formatQuestion(question)}\n\n` +
      `Send A, B, C, or D! 🎯`
    );
  }
};

// Helper functions
async function fetchQuestionAndCheck(questionId, answerLetter) {
  return await executeQuery(async (supabase) => {
    const { data: question, error } = await supabase
      .from('mcqs')
      .select('*, topics(display_name), subjects(display_name)')
      .eq('id', questionId)
      .single();

    if (error || !question) throw new Error('Question not found');

    const correctChoice = String(question.correct_choice || '')
      .toUpperCase()
      .trim();
    const userAnswer = String(answerLetter || '')
      .toUpperCase()
      .trim();
    const correct = userAnswer === correctChoice;

    return { question, correct, correctChoice };
  });
}

async function updateUserStats(userId, isCorrect) {
  return await executeQuery(async (supabase) => {
    const { data: user } = await supabase
      .from('users')
      .select('streak_count, total_questions_answered, total_correct_answers, correct_answer_rate')
      .eq('id', userId)
      .single();

    const oldStreak = user?.streak_count || 0;
    const newStreak = isCorrect ? oldStreak + 1 : 0;
    const totalQuestions = (user?.total_questions_answered || 0) + 1;
    const correctAnswers = (user?.total_correct_answers || 0) + (isCorrect ? 1 : 0);
    const newRate = totalQuestions > 0 ? correctAnswers / totalQuestions : 0;

    await supabase
      .from('users')
      .update({
        streak_count: newStreak,
        total_questions_answered: totalQuestions,
        total_correct_answers: correctAnswers,
        correct_answer_rate: newRate,
        last_active_at: new Date().toISOString()
      })
      .eq('id', userId);

    return {
      newStreak,
      stats: {
        accuracy: Math.round(newRate * 100),
        totalQuestions,
        correctAnswers
      }
    };
  });
}

async function generateDetailedFeedback(user, question, correct, correctChoice, newStreak, stats) {
  const topicName = question.topics?.display_name || 'this topic';

  if (correct) {
    let feedback = `✅ Well done! You got it right.\n\n`;

    if (newStreak > 1) {
      feedback += `🔥 ${newStreak}-question streak! You're building momentum.\n\n`;
    }

    feedback += `📊 **Quick Check-in:**\n`;
    feedback += `• ${topicName}: You're getting the hang of this\n`;
    feedback += `• Overall accuracy: ${stats.accuracy}%\n`;
    feedback += `• Questions completed: ${stats.totalQuestions}\n\n`;

    if (stats.accuracy >= 80) {
      feedback += `🌟 Strong performance! You're building solid foundations.`;
    } else if (stats.accuracy >= 60) {
      feedback += `💪 Good progress! Each question makes you stronger.`;
    } else {
      feedback += `🌱 You're learning step by step. That's how mastery builds.`;
    }

    return feedback;
  } else {
    let feedback = `Not quite yet, and that's okay. The correct answer was **${correctChoice}**.\n\n`;

    if (newStreak === 0 && user.streak_count > 0) {
      feedback += `Your streak reset, but you can start a new one right now. 🔄\n\n`;
    }

    feedback += `📊 **Quick Check-in:**\n`;
    feedback += `• ${topicName}: Keep practicing—you're building the method\n`;
    feedback += `• Overall accuracy: ${stats.accuracy}%\n`;
    feedback += `• Questions completed: ${stats.totalQuestions}\n\n`;

    feedback += `🧠 **Next Step:**\n`;
    feedback += `• Practice more ${topicName} questions\n`;
    feedback += `• Focus on the step-by-step process\n\n`;

    feedback += `Remember: every mistake teaches you something. You're growing. 🌱`;

    return feedback;
  }
}

function calculateUserDifficulty(user) {
  const rate = user.correct_answer_rate || 0.5;
  if (rate >= 0.8) return 'medium'; // Don't jump to hard too quickly
  if (rate >= 0.6) return 'medium';
  return 'easy';
}

function getDifficultyEmoji(difficulty) {
  const emojis = {
    easy: '🟢',
    medium: '🟡',
    hard: '🔴'
  };
  return emojis[difficulty] || '🟡';
}

async function createPracticeReminder(userId) {
  const tonight = new Date();
  tonight.setHours(19, 0, 0, 0); // 7 PM
  if (tonight <= new Date()) {
    tonight.setDate(tonight.getDate() + 1); // Tomorrow if already past 7 PM
  }

  try {
    await executeQuery(async (supabase) => {
      await supabase.from('reminders').insert({
        user_id: userId,
        type: 'practice_reminder',
        scheduled_for: tonight.toISOString(),
        metadata: { source: 'practice_continue' }
      });
    });
  } catch (error) {
    console.warn('Practice reminder creation failed (non-fatal):', error.message);
  }
}
