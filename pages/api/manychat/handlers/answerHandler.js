import { executeQuery } from '../config/database.js';
import { questionService } from '../services/questionService.js';
import { aiService } from '../services/aiService.js';
import { updateUserStats } from '../services/userService.js';
import { formatStreak } from '../utils/responseFormatter.js';

export async function handleAnswerSubmission(user, command) {
  try {
    console.log(`📝 Processing answer ${command.value} from user ${user.id}`);

    // Check if user has a current question
    if (!user.current_question_id) {
      return `No question to answer! Type "next" to get a fresh question! 🎯`;
    }

    // Get the current question
    const question = await getCurrentQuestion(user.current_question_id);
    if (!question) {
      await clearUserQuestion(user.id);
      return `That question expired! Type "next" for a fresh one! 🔄`;
    }

    // Validate and process answer
    const userAnswer = command.value.toUpperCase();
    const correctAnswer = question.correct_choice.toUpperCase();
    const isCorrect = userAnswer === correctAnswer;

    console.log(`🎯 Answer check: ${userAnswer} vs ${correctAnswer} = ${isCorrect}`);

    // Calculate new streak
    const newStreak = isCorrect ? (user.streak_count || 0) + 1 : 0;

    // Record the response
    const responseData = await questionService.recordUserResponse(
      user.id,
      question.id,
      userAnswer,
      isCorrect
    );

    // Update user stats
    await updateUserStats(user.id, isCorrect, newStreak);

    // Clear current question
    await clearUserQuestion(user.id);

    // Generate response
    let reply = '';

    if (isCorrect) {
      reply = await generateCorrectAnswerResponse(user, newStreak, question);
    } else {
      // Log weakness
      await questionService.logWeakness(
        user.id,
        question.id,
        userAnswer,
        responseData.topicId,
        responseData.subjectId
      );

      // Generate explanation with GPT
      reply = await generateIncorrectAnswerResponse(user, question, userAnswer, correctAnswer);
    }

    console.log(`✅ Answer processed for user ${user.id}: ${isCorrect ? 'correct' : 'incorrect'}`);

    return reply;
  } catch (error) {
    console.error('❌ Answer processing error:', error);

    // Clear question state on error
    if (user.current_question_id) {
      await clearUserQuestion(user.id);
    }

    throw new Error(`Failed to process answer: ${error.message}`);
  }
}

async function getCurrentQuestion(questionId) {
  return executeQuery(async (supabase) => {
    const { data, error } = await supabase
      .from('mcqs')
      .select(
        `
        *,
        topics(id, name, display_name),
        subjects(id, name, display_name)
      `
      )
      .eq('id', questionId)
      .single();

    if (error) throw error;
    return data;
  });
}

async function clearUserQuestion(userId) {
  return executeQuery(async (supabase) => {
    const { error } = await supabase
      .from('users')
      .update({
        current_question_id: null,
        last_active_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) throw error;
  });
}

async function generateCorrectAnswerResponse(user, newStreak, question) {
  try {
    const streakEmoji = formatStreak(newStreak);
    const topicName = question.topics?.display_name || 'that';

    let response = `💯 Howzit sharp shooter! You nailed it! ${streakEmoji}`;

    if (newStreak > 1) {
      response += `\nStreak: ${newStreak} ${streakEmoji}`;

      // Add motivational message for longer streaks
      if (newStreak >= 10) {
        const motivation = await aiService.generateMotivationalMessage(user, 'streak');
        response += `\n\n${motivation}`;
      } else if (newStreak >= 5) {
        response += `\nYou're absolutely on fire! 🔥`;
      }
    }

    response += `\n\nYou're mastering ${topicName}! Type "next" for another question! 🚀`;

    return response;
  } catch (error) {
    console.error('❌ Correct answer response generation failed:', error);
    return `💯 Correct! You're getting sharper! 🔥\n\nType "next" for another question! 🚀`;
  }
}

async function generateIncorrectAnswerResponse(user, question, userAnswer, correctAnswer) {
  try {
    console.log(`🤖 Generating GPT explanation for incorrect answer`);

    // Generate GPT explanation
    const explanation = await aiService.generateExplanation(
      question,
      userAnswer,
      correctAnswer,
      user
    );

    // Build response
    let response = `Aweh, not this time. Correct answer was ${correctAnswer}.\n\n`;
    response += explanation;
    response += `\n\nType "next" to bounce back! 💪`;

    return response;
  } catch (error) {
    console.error('❌ GPT explanation failed, using fallback:', error);

    // Fallback explanation
    const topicName = question.topics?.display_name || 'that concept';

    return `Aweh, not this time. Correct answer was ${correctAnswer}.\n\n🧠 No stress - classic slip in ${topicName}. Review the concept and keep practicing!\n\n💡 Quick tip: Every mistake is a learning opportunity!\n\nType "next" to bounce back! 💪`;
  }
}

export async function getAnswerFeedback(user, isCorrect, streak, topic) {
  if (isCorrect) {
    const context = streak >= 5 ? 'streak' : 'general';
    return await aiService.generateMotivationalMessage(user, context);
  } else {
    return await aiService.generateMotivationalMessage(user, 'comeback');
  }
}
