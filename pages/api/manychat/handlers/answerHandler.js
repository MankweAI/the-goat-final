/**
 * Enhanced Answer Handler with Post-Answer Menu
 * Date: 2025-08-15 18:30:00 UTC
 * This version provides feedback and a clear, numbered menu for the user's next action.
 */

import { updateUser } from '../services/userService.js';
import { executeQuery } from '../config/database.js';
import { formatStreak, formatTopicName } from '../utils/responseFormatter.js';

export async function handleAnswerSubmission(user, command) {
  try {
    console.log(`📝 Processing answer from user ${user.id}: ${command.answer}`);

    const question = await getCurrentQuestion(user);

    if (!question) {
      // This state should ideally not be reached if the parser is correct.
      return `No active question to answer! Type "next" to get a fresh question! 🎯`;
    }

    const userAnswer = command.answer.toUpperCase();
    const correctAnswer = (question.correct_choice || '').toUpperCase();
    const isCorrect = userAnswer === correctAnswer;

    console.log(
      `🔍 Answer check: user=${userAnswer}, correct=${correctAnswer}, isCorrect=${isCorrect}`
    );

    // Prepare all user updates in one object for a single DB call
    const { userUpdates, weaknessTag } = prepareUserUpdates(user, question, isCorrect, userAnswer);

    // Execute updates
    await Promise.all([
      updateUser(user.id, userUpdates),
      logUserWeakness(user.id, question, weaknessTag)
    ]);

    // Generate feedback message
    const feedback = formatAnswerFeedback(
      isCorrect,
      correctAnswer,
      userUpdates.streak_count,
      weaknessTag
    );

    // *** FIX A: Append the numbered post-answer menu to the feedback ***
    const postAnswerMenu =
      `\n\n**What's next?**\n\n` +
      `1️⃣ Next Question\n` +
      `2️⃣ Challenge a Friend\n` +
      `3️⃣ Main Menu`;

    console.log(`✅ Answer processed for user ${user.id}: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);

    return feedback + postAnswerMenu;
  } catch (error) {
    console.error(`❌ Answer submission error:`, error);
    await updateUser(user.id, { current_question_id: null, current_menu: 'main' }); // Reset state on error
    return `Eish, something glitched while checking your answer. Type "next" for a fresh question! 🔄`;
  }
}

// ===============================
// HELPER FUNCTIONS
// ===============================

function prepareUserUpdates(user, question, isCorrect, userAnswer) {
  const oldStreak = user.streak_count || 0;
  const totalQuestions = (user.total_questions_answered || 0) + 1;
  const correctAnswers = (user.total_correct_answers || 0) + (isCorrect ? 1 : 0);

  // *** FIX A: Set the user's menu state to 'post_answer' ***
  // This tells the commandParser to expect a 1, 2, or 3 on the next message.
  const userUpdates = {
    current_question_id: null,
    current_menu: 'post_answer',
    streak_count: isCorrect ? oldStreak + 1 : 0,
    total_questions_answered: totalQuestions,
    total_correct_answers: correctAnswers,
    correct_answer_rate: correctAnswers / totalQuestions,
    last_active_at: new Date().toISOString()
  };

  let weaknessTag = null;
  if (!isCorrect && question.choices && question.choices[userAnswer]) {
    weaknessTag = question.choices[userAnswer].weakness_tag;
  }

  return { userUpdates, weaknessTag };
}

async function getCurrentQuestion(user) {
  if (!user.current_question_id) return null;
  return executeQuery(async (supabase) => {
    const { data, error } = await supabase
      .from('mcqs')
      .select('*')
      .eq('id', user.current_question_id)
      .single();
    if (error) {
      console.error(`Error fetching question ${user.current_question_id}:`, error);
      return null;
    }
    return data;
  });
}

async function logUserWeakness(userId, question, weaknessTag) {
  if (!weaknessTag || weaknessTag === 'none') return;
  try {
    await executeQuery(async (supabase) => {
      const { error } = await supabase.from('user_weaknesses').insert({
        user_id: userId,
        mcq_id: question.id,
        weakness_tag: weaknessTag,
        logged_at: new Date().toISOString()
      });
      if (error) console.error(`❌ DB error logging weakness:`, error);
    });
  } catch (error) {
    console.error(`❌ Top-level error in logUserWeakness:`, error);
  }
}

function formatAnswerFeedback(isCorrect, correctChoice, streak, weaknessTag = null) {
  if (isCorrect) {
    const emoji = formatStreak(streak);
    let message = `💯 Sharp shooter! You nailed it! ${emoji}`;
    if (streak > 1) {
      message += `\nThat's a **${streak}-question streak**!`;
    }
    return message;
  } else {
    let feedback = `Aweh, not this time. The correct answer was **${correctChoice}**.`;
    if (weaknessTag) {
      feedback += `\n\nThat's a classic slip-up with **${formatTopicName(weaknessTag)}**. Keep an eye on that! 💪`;
    }
    return feedback;
  }
}
