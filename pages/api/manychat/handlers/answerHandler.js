/**
 * Enhanced Answer Handler with Fixed Post-Answer Menu
 * Date: 2025-08-15 17:13:45 UTC
 */

import { updateUser } from '../services/userService.js';
import { executeQuery } from '../config/database.js';
import { formatStreak, formatTopicName } from '../utils/responseFormatter.js';

export async function handleAnswerSubmission(user, command) {
  try {
    console.log(`📝 Processing answer from user ${user.id}: ${command.answer}`);

    const question = await getCurrentQuestion(user);

    if (!question) {
      return `No active question to answer! Type "next" to get a fresh question! 🎯`;
    }

    const userAnswer = command.answer.toUpperCase();
    const correctAnswer = (question.correct_choice || '').toUpperCase();
    const isCorrect = userAnswer === correctAnswer;

    console.log(
      `🔍 Answer check: user=${userAnswer}, correct=${correctAnswer}, isCorrect=${isCorrect}`
    );

    const { userUpdates, weaknessTag } = prepareUserUpdates(user, question, isCorrect, userAnswer);

    await Promise.all([
      updateUser(user.id, userUpdates),
      logUserWeakness(user.id, question, weaknessTag)
    ]);

    const feedback = formatAnswerFeedback(
      isCorrect,
      correctAnswer,
      userUpdates.streak_count,
      weaknessTag
    );

    const postAnswerMenu =
      `\n\n**What's next?**\n\n` +
      `1️⃣ Next Question\n` +
      `2️⃣ Switch Topic\n` +
      `3️⃣ Challenge Friend\n` +
      `4️⃣ Progress Report\n` +
      `5️⃣ Main Menu`;

    console.log(`✅ Answer processed for user ${user.id}: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);

    return feedback + postAnswerMenu;
  } catch (error) {
    console.error(`❌ Answer submission error:`, error);
    try {
      await updateUser(user.id, {
        current_question_id: null,
        current_menu: 'main',
        last_active_at: new Date().toISOString()
      });
    } catch (updateError) {
      console.error(`❌ Failed to reset user state:`, updateError);
    }
    return `Eish, something glitched while checking your answer. Type "next" for a fresh question! 🔄`;
  }
}

function prepareUserUpdates(user, question, isCorrect, userAnswer) {
  const oldStreak = user.streak_count || 0;
  const totalQuestions = (user.total_questions_answered || 0) + 1;
  const correctAnswers = (user.total_correct_answers || 0) + (isCorrect ? 1 : 0);

  const userUpdates = {
    current_question_id: null,
    current_menu: 'post_answer',
    streak_count: isCorrect ? oldStreak + 1 : 0,
    total_questions_answered: totalQuestions,
    total_correct_answers: correctAnswers,
    correct_answer_rate: totalQuestions > 0 ? correctAnswers / totalQuestions : 0,
    last_active_at: new Date().toISOString()
  };

  let weaknessTag = null;
  if (!isCorrect && question.choices) {
    try {
      const choices =
        typeof question.choices === 'string' ? JSON.parse(question.choices) : question.choices;
      if (Array.isArray(choices)) {
        const choiceData = choices.find(
          (c) =>
            c.choice === userAnswer ||
            (!c.choice && userAnswer === String.fromCharCode(65 + choices.indexOf(c)))
        );
        weaknessTag = choiceData?.weakness_tag;
      }
    } catch (error) {
      console.error(`❌ Error parsing choices for weakness:`, error);
    }
  }

  return { userUpdates, weaknessTag };
}

async function getCurrentQuestion(user) {
  if (!user.current_question_id) return null;
  try {
    return await executeQuery(async (supabase) => {
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
  } catch (error) {
    console.error(`❌ getCurrentQuestion error:`, error);
    return null;
  }
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
      if (error) {
        console.error(`❌ DB error logging weakness:`, error);
      } else {
        console.log(`✅ Logged weakness for user ${userId}: ${weaknessTag}`);
      }
    });
  } catch (error) {
    console.error(`❌ Top-level error in logUserWeakness:`, error);
  }
}

function formatAnswerFeedback(isCorrect, correctChoice, streak, weaknessTag = null) {
  try {
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
  } catch (error) {
    console.error(`❌ formatAnswerFeedback error:`, error);
    return isCorrect ? `Correct! 🔥` : `Not quite! Correct answer was ${correctChoice}. 💪`;
  }
}
