/**
 * Enhanced Answer Handler with proper error handling
 */

import { updateUser } from '../services/userService.js';
import { executeQuery } from '../config/database.js';

export async function handleAnswerSubmission(user, command) {
  try {
    console.log(`📝 Processing answer from user ${user.id}: ${command.answer}`);

    // Get current question
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

    // Update user stats
    const oldRate = user.correct_answer_rate || 0.5;
    const oldStreak = user.streak_count || 0;

    const { newRate, newStreak } = await updateUserStats(user.id, isCorrect, oldRate, oldStreak);

    // Clear current question
    await clearUserQuestion(user.id);

    // Log weakness if incorrect
    if (!isCorrect) {
      const choices = parseChoices(question.choices);
      const chosen = choices.find(
        (c) =>
          (c.choice && c.choice.toUpperCase() === userAnswer) ||
          (!c.choice && userAnswer === String.fromCharCode(65 + choices.indexOf(c)))
      );

      if (chosen?.weakness_tag) {
        await logUserWeakness(user.id, chosen.weakness_tag);
      }
    }

    // Generate feedback
    const feedback = formatAnswerFeedback(
      isCorrect,
      correctAnswer,
      newStreak,
      isCorrect ? null : 'that concept'
    );

    console.log(`✅ Answer processed for user ${user.id}: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);

    return feedback;
  } catch (error) {
    console.error(`❌ Answer submission error:`, error);

    // Try to clear question on error
    try {
      await clearUserQuestion(user.id);
    } catch (clearError) {
      console.error(`💥 Failed to clear question on error:`, clearError);
    }

    return `Eish, something glitched while checking your answer. Type "next" for a fresh question! 🔄`;
  }
}

// Helper function to parse choices
function parseChoices(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Import these functions from index.js or make them available
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

      if (error) return null;
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
    return true;
  } catch (error) {
    console.error(`❌ clearUserQuestion error:`, error);
    return false;
  }
}

async function updateUserStats(userId, isCorrect, oldRate = 0.5, oldStreak = 0) {
  try {
    const newRate = (oldRate * 4 + (isCorrect ? 1 : 0)) / 5;
    const newStreak = isCorrect ? oldStreak + 1 : 0;

    await updateUser(userId, {
      correct_answer_rate: newRate,
      streak_count: newStreak,
      last_active_at: new Date().toISOString()
    });

    return { newRate, newStreak };
  } catch (error) {
    console.error(`❌ updateUserStats error:`, error);
    return { newRate: oldRate, newStreak: oldStreak };
  }
}

async function logUserWeakness(userId, weaknessTag) {
  try {
    if (!weaknessTag) return;

    await executeQuery(async (supabase) => {
      const { error } = await supabase.from('user_weaknesses').insert({
        user_id: userId,
        weakness_tag: weaknessTag,
        logged_at: new Date().toISOString()
      });

      if (error) {
        console.error(`❌ Log weakness error:`, error);
      }
    });
  } catch (error) {
    console.error(`❌ logUserWeakness error:`, error);
  }
}

function formatAnswerFeedback(isCorrect, correctChoice, streak, weaknessTag = null) {
  if (isCorrect) {
    const emoji = streak >= 5 ? '🔥🔥⚡' : streak >= 3 ? '🔥🔥' : '🔥';
    return `💯 Howzit sharp shooter! You nailed it.\nStreak: ${streak} ${emoji}\n\nType "next" for another one.`;
  } else {
    let feedback = `Eish, not this time! Correct answer was ${correctChoice}.`;
    if (weaknessTag) {
      feedback += ` Classic slip in ${weaknessTag}. 💪`;
    }
    feedback += `\n\nType "next" to bounce back.`;
    return feedback;
  }
}
