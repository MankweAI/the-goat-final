import { executeQuery } from '../config/database.js';
import { questionService } from '../services/questionService.js';
import { aiService } from '../services/aiService.js';
import { updateUserStats } from '../services/userService.js';
import { formatStreak } from '../utils/responseFormatter.js';
import { generatePostAnswerResponse } from './postAnswerHandler.js'; // ✅ NEW IMPORT

/**
 * Updated Answer Handler with Post-Answer Integration
 */
export async function handleAnswerSubmission(user, command) {
  try {
    console.log(`📝 Processing answer for user ${user.id}:`, {
      answer: command.answer || command.value,
      originalInput: command.originalInput,
      currentQuestionId: user.current_question_id
    });

    // 1) Check if user has an active question
    if (!user.current_question_id) {
      console.log(`❌ No current question for user ${user.id}`);
      return generateNoQuestionResponse();
    }

    // 2) Fetch current question
    const question = await getCurrentQuestion(user.current_question_id);
    if (!question) {
      console.log(`❌ Question ${user.current_question_id} not found`);
      await clearUserQuestion(user.id);
      return generateExpiredQuestionResponse();
    }

    // 3) Extract and validate answer
    const userAnswer = extractAnswerFromCommand(command);
    if (!userAnswer) {
      console.log(`❌ Invalid answer format from user ${user.id}: "${command.originalInput}"`);
      return generateInvalidAnswerResponse(command.originalInput, question);
    }

    const correctAnswer = question.correct_choice?.toUpperCase() || 'A';
    const isCorrect = userAnswer === correctAnswer;

    // 4) Build updated statistics
    const currentStreak = user.streak_count || 0;
    const newStreak = isCorrect ? currentStreak + 1 : 0;
    const totalQuestions = (user.total_questions_answered || 0) + 1;
    const totalCorrect = (user.total_correct_answers || 0) + (isCorrect ? 1 : 0);

    // 5) Build response payload
    const answerResult = {
      isCorrect,
      userAnswer,
      correctAnswer,
      newStreak,
      streakLost: currentStreak,
      stats: {
        totalQuestions,
        totalCorrect,
        accuracy: Math.round((totalCorrect / totalQuestions) * 100)
      },
      question
    };

    // 6) Record the answer and update user stats
    await questionService.recordUserResponse(user.id, question.id, userAnswer, isCorrect);

    await updateUserStats(user.id, {
      isCorrect,
      newStreak,
      totalQuestions,
      totalCorrect,
      lastQuestionTopic: question.topics?.id,
      lastQuestionSubject: question.subjects?.id
    });

    // 7) Clear the question and switch to post-answer menu
    await clearUserQuestion(user.id, 'post_answer');

    // 8) Generate post-answer response
    const reply = await generatePostAnswerResponse(user, question, answerResult);

    console.log(
      `✅ Answer processed successfully for user ${user.id}: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`
    );
    return reply;
  } catch (error) {
    console.error(`💥 Answer processing error for user ${user.id}:`, error);

    // Failsafe
    if (user.current_question_id) {
      try {
        await clearUserQuestion(user.id, 'main');
      } catch (clearError) {
        console.error(`💥 Failed to clear question on error:`, clearError);
      }
    }

    return generateErrorResponse();
  }
}
