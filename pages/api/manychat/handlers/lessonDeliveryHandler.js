/**
 * Lesson Delivery Handler
 * Date: 2025-08-18 11:35:00 UTC
 * Author: sophoniagoat
 *
 * Handles lesson delivery, navigation, and feedback collection
 */

import { executeQuery } from '../config/database.js';
import { updateUser } from '../services/userService.js';
import { lessonService } from '../services/lessonService.js';
import { MESSAGES } from '../config/constants.js';
import { studyPlanHandler } from './studyPlanHandler.js';

export const lessonDeliveryHandler = {
  /**
   * Start lesson delivery
   *
   * @param {Object} user - User object
   * @param {Object} lesson - Lesson object
   * @param {Object} context - Delivery context
   * @returns {string} Formatted lesson
   */
  async startLesson(user, lesson, context = {}) {
    try {
      console.log(`📚 Starting lesson delivery for user ${user.id}, lesson ${lesson.id}`);

      // Set user state
      await updateUser(user.id, {
        current_menu: 'lesson_active',
        current_lesson_id: lesson.id,
        lesson_context: JSON.stringify(context),
        last_active_at: new Date().toISOString()
      });

      // Record lesson view
      await lessonService.recordLessonView(lesson.id, user.id, context);

      // Format and return lesson
      const formattedLesson = lessonService.formatLesson(lesson, {
        showHeader: true,
        showFooter: true,
        showFeedbackPrompt: true,
        dayNumber: context.dayNumber,
        lessonNumber: context.lessonNumber,
        totalLessons: context.totalLessons
      });

      return formattedLesson;
    } catch (error) {
      console.error('❌ Lesson start error:', error);
      return `I'm having trouble starting the lesson. Please try again or type "menu" to return to the main menu.`;
    }
  },

  /**
   * Handle lesson navigation command
   *
   * @param {Object} user - User object
   * @param {string} command - Navigation command
   * @returns {Object} Response object
   */
  async handleLessonNavigation(user, command) {
    try {
      console.log(`📝 Lesson navigation command: ${command} from user ${user.id}`);

      const { currentLesson, context } = await this.getCurrentLessonData(user);

      if (!currentLesson) {
        return {
          message: `No active lesson found. Type "menu" to return to the main menu.`,
          nextState: 'welcome'
        };
      }

      switch (command.toLowerCase()) {
        case 'next':
          // Move to next content (practice or next lesson)
          return await this.moveToNextContent(user, currentLesson, context);

        case 'repeat':
          // Repeat the current lesson
          return {
            message: lessonService.formatLesson(currentLesson, {
              showHeader: true,
              showFooter: true,
              showFeedbackPrompt: true,
              dayNumber: context.dayNumber,
              lessonNumber: context.lessonNumber,
              totalLessons: context.totalLessons
            }),
            nextState: 'lesson_active'
          };

        case 'skip':
          // Skip this lesson
          return await this.skipLesson(user, currentLesson, context);

        default:
          if (command.toLowerCase().startsWith('rate ')) {
            // Handle rating command
            return await this.handleLessonRating(user, currentLesson, command);
          }

          // Unrecognized command
          return {
            message: `To continue with your lesson, type "next" when you're ready, or "rate 1-5" to provide feedback.`,
            nextState: 'lesson_active'
          };
      }
    } catch (error) {
      console.error('❌ Lesson navigation error:', error);
      return {
        message: `I'm having trouble processing that command. Type "next" to continue or "menu" to return to the main menu.`,
        nextState: 'lesson_active'
      };
    }
  },

  /**
   * Get current lesson data and context
   *
   * @param {Object} user - User object
   * @returns {Object} Current lesson and context
   */
  async getCurrentLessonData(user) {
    try {
      // Get current lesson ID
      const lessonId = user.current_lesson_id;
      if (!lessonId) {
        return { currentLesson: null, context: {} };
      }

      // Get lesson content
      const lesson = await lessonService.getLessonById(lessonId);
      if (!lesson) {
        return { currentLesson: null, context: {} };
      }

      // Parse context
      let context = {};
      try {
        context = user.lesson_context ? JSON.parse(user.lesson_context) : {};
      } catch (e) {
        console.error('❌ Context parsing error:', e);
        context = {};
      }

      return { currentLesson: lesson, context };
    } catch (error) {
      console.error('❌ Current lesson data fetch error:', error);
      return { currentLesson: null, context: {} };
    }
  },

  /**
   * Move to next content (practice or next lesson)
   *
   * @param {Object} user - User object
   * @param {Object} currentLesson - Current lesson
   * @param {Object} context - Lesson context
   * @returns {Object} Response object
   */
  async moveToNextContent(user, currentLesson, context) {
    try {
      // Check if we're in a study plan
      if (context.studyPlanId) {
        return await this.moveToNextStudyPlanContent(user, currentLesson, context);
      }

      // Not in a study plan - go to related practice
      const practiceQuestion = await this.getRelatedPracticeQuestion(
        currentLesson.topic,
        user.grade
      );

      if (practiceQuestion) {
        // Update user state
        await updateUser(user.id, {
          current_menu: 'practice_active',
          current_lesson_id: null,
          current_question_id: practiceQuestion.id,
          last_active_at: new Date().toISOString()
        });

        return {
          message: this.formatPracticeQuestion(practiceQuestion, currentLesson.topic),
          nextState: 'practice_active'
        };
      }

      // No practice question available - suggest another lesson
      const nextLesson = await lessonService.getRecommendedNextLesson(user.id, currentLesson.topic);

      if (nextLesson) {
        return {
          message: `Great! Let's continue with another lesson.\n\n${lessonService.formatLesson(nextLesson)}`,
          nextState: 'lesson_active'
        };
      }

      // No next lesson available
      return {
        message: `You've completed this lesson! Type "menu" to explore other topics or "practice" to try some exercises.`,
        nextState: 'welcome'
      };
    } catch (error) {
      console.error('❌ Next content error:', error);
      return {
        message: `I'm having trouble finding the next content. Type "menu" to return to the main menu.`,
        nextState: 'welcome'
      };
    }
  },

  /**
   * Move to next content in study plan
   *
   * @param {Object} user - User object
   * @param {Object} currentLesson - Current lesson
   * @param {Object} context - Lesson context
   * @returns {Object} Response object
   */
  async moveToNextStudyPlanContent(user, currentLesson, context) {
    try {
      // Get study plan
      const { session, plan } = await studyPlanHandler.getUserActivePlan(user.id);

      if (!plan || !plan.plan_data) {
        return {
          message: `I couldn't find your active study plan. Type "menu" to return to the main menu.`,
          nextState: 'welcome'
        };
      }

      const planData = plan.plan_data;
      const dayNumber = context.dayNumber || 1;
      const lessonNumber = context.lessonNumber || 1;

      // Find current day plan
      const dayPlan = planData.days.find((d) => d.day === dayNumber);
      if (!dayPlan) {
        return {
          message: `I couldn't find day ${dayNumber} in your study plan. Type "menu" to return to the main menu.`,
          nextState: 'welcome'
        };
      }

      // Check if there are more lessons today
      if (lessonNumber < dayPlan.lessons.length) {
        // Move to next lesson
        const nextLessonNumber = lessonNumber + 1;
        const nextLesson = dayPlan.lessons[nextLessonNumber - 1];

        // Update user state with next lesson
        const newContext = {
          ...context,
          lessonNumber: nextLessonNumber
        };

        await updateUser(user.id, {
          current_menu: 'lesson_active',
          current_lesson_id: nextLesson.id,
          lesson_context: JSON.stringify(newContext),
          last_active_at: new Date().toISOString()
        });

        return {
          message: lessonService.formatLesson(nextLesson, {
            showHeader: true,
            showFooter: true,
            showFeedbackPrompt: true,
            dayNumber: dayNumber,
            lessonNumber: nextLessonNumber,
            totalLessons: dayPlan.lessons.length
          }),
          nextState: 'lesson_active'
        };
      }

      // No more lessons today - move to practice
      return await studyPlanHandler.startPracticeQuestions(user, session, plan, dayNumber);
    } catch (error) {
      console.error('❌ Next study plan content error:', error);
      return {
        message: `I'm having trouble finding your next lesson. Type "menu" to return to the main menu.`,
        nextState: 'welcome'
      };
    }
  },

  /**
   * Skip current lesson
   *
   * @param {Object} user - User object
   * @param {Object} currentLesson - Current lesson
   * @param {Object} context - Lesson context
   * @returns {Object} Response object
   */
  async skipLesson(user, currentLesson, context) {
    try {
      // Record the skip as feedback (rating of 1)
      await lessonService.submitLessonFeedback(
        currentLesson.id,
        user.id,
        1,
        null,
        'User skipped lesson'
      );

      // Move to next content as if completed
      return await this.moveToNextContent(user, currentLesson, context);
    } catch (error) {
      console.error('❌ Lesson skip error:', error);
      return {
        message: `I'm having trouble skipping this lesson. Type "next" to continue anyway.`,
        nextState: 'lesson_active'
      };
    }
  },

  /**
   * Handle lesson rating command
   *
   * @param {Object} user - User object
   * @param {Object} lesson - Lesson object
   * @param {string} command - Rating command
   * @returns {Object} Response object
   */
  async handleLessonRating(user, lesson, command) {
    try {
      // Parse rating from command (e.g., "rate 4")
      const ratingMatch = command.match(/rate\s+(\d)/i);
      if (!ratingMatch) {
        return {
          message: `Please rate the lesson from 1-5 (e.g., "rate 4"). Type "next" to continue without rating.`,
          nextState: 'lesson_active'
        };
      }

      const rating = parseInt(ratingMatch[1]);
      if (isNaN(rating) || rating < 1 || rating > 5) {
        return {
          message: `Please provide a valid rating from 1-5. Type "next" to continue without rating.`,
          nextState: 'lesson_active'
        };
      }

      // Record the feedback
      await lessonService.submitLessonFeedback(lesson.id, user.id, rating);

      // Provide appropriate response based on rating
      let responseMessage = '';
      if (rating >= 4) {
        responseMessage = `Thank you for your ${rating}/5 rating! I'm glad you found this lesson helpful.\n\n`;
      } else if (rating === 3) {
        responseMessage = `Thanks for your 3/5 rating. We'll use your feedback to improve our lessons.\n\n`;
      } else {
        responseMessage = `I appreciate your ${rating}/5 rating. We'll work on making our lessons more helpful.\n\n`;
      }

      // Ask follow-up for low ratings (optional)
      if (rating <= 3) {
        // Update user state to expect follow-up
        await updateUser(user.id, {
          current_menu: 'lesson_feedback',
          last_active_at: new Date().toISOString()
        });

        return {
          message:
            responseMessage +
            `What would have made this lesson more helpful for you? (Type your suggestion or "skip" to continue)`,
          nextState: 'lesson_feedback'
        };
      }

      // For high ratings, just continue
      responseMessage += `Type "next" to continue to practice questions!`;

      return {
        message: responseMessage,
        nextState: 'lesson_active'
      };
    } catch (error) {
      console.error('❌ Lesson rating error:', error);
      return {
        message: `I couldn't process your rating. Type "next" to continue.`,
        nextState: 'lesson_active'
      };
    }
  },

  /**
   * Handle lesson feedback text
   *
   * @param {Object} user - User object
   * @param {string} feedbackText - User's feedback text
   * @returns {Object} Response object
   */
  async handleLessonFeedbackText(user, feedbackText) {
    try {
      const { currentLesson, context } = await this.getCurrentLessonData(user);

      if (!currentLesson) {
        return {
          message: `Thank you for your feedback! Type "menu" to return to the main menu.`,
          nextState: 'welcome'
        };
      }

      // Skip if requested
      if (feedbackText.toLowerCase() === 'skip') {
        return {
          message: `Thanks anyway! Type "next" to continue.`,
          nextState: 'lesson_active'
        };
      }

      // Record the qualitative feedback
      await executeQuery(async (supabase) => {
        const { data } = await supabase
          .from('lesson_feedback')
          .select('id')
          .eq('lesson_id', currentLesson.id)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (data) {
          // Update existing feedback
          await supabase
            .from('lesson_feedback')
            .update({
              qualitative_feedback: feedbackText,
              updated_at: new Date().toISOString()
            })
            .eq('id', data.id);
        } else {
          // Create new feedback record with text only
          await lessonService.submitLessonFeedback(
            currentLesson.id,
            user.id,
            3, // Default middle rating
            null,
            feedbackText
          );
        }
      });

      // Continue to next content
      return {
        message: `Thank you for your feedback! It will help us improve our lessons.\n\nType "next" to continue.`,
        nextState: 'lesson_active'
      };
    } catch (error) {
      console.error('❌ Feedback text handling error:', error);
      return {
        message: `Thank you for your feedback! Type "next" to continue.`,
        nextState: 'lesson_active'
      };
    }
  },

  /**
   * Get related practice question
   *
   * @param {string} topic - Lesson topic
   * @param {string} grade - User grade
   * @returns {Object} Practice question
   */
  async getRelatedPracticeQuestion(topic, grade) {
    return executeQuery(async (supabase) => {
      const gradeLevel = parseInt(grade);

      let query = supabase
        .from('practice_questions')
        .select('*')
        .eq('topic', topic)
        .eq('is_active', true);

      // Filter by grade if valid
      if (!isNaN(gradeLevel)) {
        query = query.in('grade_level', [gradeLevel, gradeLevel - 1]);
      }

      // Get a random question
      const { data, error } = await query
        .order('last_used_at', { ascending: true, nullsFirst: true })
        .limit(1);

      if (error) {
        console.error('❌ Practice question fetch error:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      // Update last used timestamp
      await supabase
        .from('practice_questions')
        .update({
          last_used_at: new Date().toISOString()
        })
        .eq('id', data[0].id);

      return data[0];
    });
  },

  /**
   * Format practice question
   *
   * @param {Object} question - Practice question
   * @param {string} topic - Question topic
   * @returns {string} Formatted question
   */
  formatPracticeQuestion(question, topic) {
    return (
      `🧮 **PRACTICE QUESTION: ${topic.toUpperCase()}**\n\n` +
      `${question.question_text}\n\n` +
      `When you're ready for the solution, type "solution".\n\n` +
      `If you'd like to skip this question, type "skip".`
    );
  }
};

