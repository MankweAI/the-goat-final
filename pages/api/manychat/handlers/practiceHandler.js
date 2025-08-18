/**
 * Practice Question Handler
 * Date: 2025-08-18 11:59:33 UTC
 * Author: sophoniagoat
 *
 * Handles practice question interactions and understanding assessment
 */

import { executeQuery } from '../config/database.js';
import { updateUser } from '../services/userService.js';
import { practiceService } from '../services/practiceService.js';
import { MESSAGES } from '../config/constants.js';

export const practiceHandler = {
  /**
   * Start a practice session
   *
   * @param {Object} user - User object
   * @param {Object} parameters - Practice parameters
   * @returns {string} Formatted question
   */
  async startPractice(user, parameters = {}) {
    try {
      console.log(
        `🧮 Starting practice for user ${user.id}, topic: ${parameters.topic || 'general'}`
      );

      // Get practice question
      let question;

      if (parameters.questionId) {
        // Use specified question
        question = await practiceService.getQuestionById(parameters.questionId);
      } else if (parameters.topic) {
        // Get question for topic
        const questions = await practiceService.getQuestionsByTopic(parameters.topic, {
          grade: user.grade || parameters.grade,
          difficulty: parameters.difficulty
        });

        if (questions.length > 0) {
          question = questions[0];
        } else {
          // Generate a question if none available
          question = await practiceService.generateQuestion({
            topic: parameters.topic,
            grade: user.grade || parameters.grade,
            difficulty: parameters.difficulty || 'medium'
          });
        }
      } else {
        // Default: get a general question based on user grade
        question = await practiceService.getFallbackQuestion('general', user.grade || 10);
      }

      if (!question) {
        return `I'm having trouble finding a practice question. Please try again or specify a topic.`;
      }

      // Record attempt
      const attemptId = await practiceService.recordQuestionAttempt(question.id, user.id, {
        sessionId: parameters.sessionId,
        studyPlanId: parameters.studyPlanId,
        dayNumber: parameters.dayNumber,
        hintsUsed: 0
      });

      // Update user state
      await updateUser(user.id, {
        current_menu: 'practice_active',
        current_question_id: question.id,
        current_attempt_id: attemptId,
        practice_context: JSON.stringify({
          topic: question.topic,
          difficulty: question.difficulty,
          hintCount: 0,
          ...parameters
        }),
        last_active_at: new Date().toISOString()
      });

      // Format and return question
      return practiceService.formatQuestion(question, {
        showHeader: true,
        showHints: true,
        hintNumber: 0,
        dayNumber: parameters.dayNumber,
        questionNumber: parameters.questionNumber,
        totalQuestions: parameters.totalQuestions
      });
    } catch (error) {
      console.error('❌ Practice start error:', error);
      return `I'm having trouble starting practice questions. Please try again or type "menu" to return to the main menu.`;
    }
  },

  /**
   * Handle practice interaction
   *
   * @param {Object} user - User object
   * @param {string} command - User command
   * @returns {Object} Response object
   */
  async handlePracticeInteraction(user, command) {
    try {
      console.log(`🧮 Practice interaction: ${command} from user ${user.id}`);

      const { currentQuestion, context } = await this.getCurrentQuestionData(user);

      if (!currentQuestion) {
        return {
          message: `No active practice question found. Type "practice" to start a new practice session.`,
          nextState: 'welcome'
        };
      }

      // Process specific commands
      switch (command.toLowerCase()) {
        case 'hint':
          return await this.provideHint(user, currentQuestion, context);

        case 'solution':
          return await this.showSolution(user, currentQuestion, context);

        case 'skip':
          return await this.skipQuestion(user, currentQuestion, context);

        default:
          // If it's a number 1-5 after solution is shown
          if (context.solutionShown && /^[1-5]$/.test(command)) {
            return await this.recordUnderstandingRating(
              user,
              currentQuestion,
              parseInt(command),
              context
            );
          }

          // Check if this is an attempt at answering the question
          if (command.length > 5 && context.solutionShown !== true) {
            return await this.assessResponse(user, currentQuestion, command, context);
          }

          // Unrecognized command
          return {
            message: `To continue, you can:\n• Type "solution" to see the answer\n• Type "hint" for a hint\n• Type "skip" to try a different question`,
            nextState: 'practice_active'
          };
      }
    } catch (error) {
      console.error('❌ Practice interaction error:', error);
      return {
        message: `I'm having trouble processing that command. Type "solution" to see the answer or "menu" to return to the main menu.`,
        nextState: 'practice_active'
      };
    }
  },

  /**
   * Get current question data and context
   *
   * @param {Object} user - User object
   * @returns {Object} Current question and context
   */
  async getCurrentQuestionData(user) {
    try {
      // Get current question ID
      const questionId = user.current_question_id;
      if (!questionId) {
        return { currentQuestion: null, context: {} };
      }

      // Get question content
      const question = await practiceService.getQuestionById(questionId);
      if (!question) {
        return { currentQuestion: null, context: {} };
      }

      // Parse context
      let context = {};
      try {
        context = user.practice_context ? JSON.parse(user.practice_context) : {};
      } catch (e) {
        console.error('❌ Context parsing error:', e);
        context = {};
      }

      return { currentQuestion: question, context };
    } catch (error) {
      console.error('❌ Current question data fetch error:', error);
      return { currentQuestion: null, context: {} };
    }
  },

  /**
   * Provide hint for current question
   *
   * @param {Object} user - User object
   * @param {Object} question - Question object
   * @param {Object} context - Practice context
   * @returns {Object} Response object
   */
  async provideHint(user, question, context) {
    try {
      // Check if hints are available
      if (!question.hints || question.hints.length === 0) {
        return {
          message: `I don't have any hints available for this question. Try approaching it step by step, or type "solution" to see the answer.`,
          nextState: 'practice_active'
        };
      }

      // Get current hint count
      const hintCount = context.hintCount || 0;
      const nextHintNumber = hintCount + 1;

      // Check if we have more hints to give
      if (nextHintNumber > question.hints.length) {
        return {
          message: `You've seen all available hints. Type "solution" when you're ready to see the complete solution.`,
          nextState: 'practice_active'
        };
      }

      // Update hint count in context
      const newContext = {
        ...context,
        hintCount: nextHintNumber
      };

      // Update user state
      await updateUser(user.id, {
        practice_context: JSON.stringify(newContext),
        last_active_at: new Date().toISOString()
      });

      // Update attempt record
      if (user.current_attempt_id) {
        await executeQuery(async (supabase) => {
          await supabase
            .from('practice_attempts')
            .update({
              hints_used: nextHintNumber,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.current_attempt_id);
        });
      }

      // Format question with hint
      const messageWithHint = practiceService.formatQuestion(question, {
        showHeader: false,
        showHints: true,
        hintNumber: nextHintNumber,
        dayNumber: context.dayNumber,
        questionNumber: context.questionNumber,
        totalQuestions: context.totalQuestions
      });

      return {
        message: messageWithHint,
        nextState: 'practice_active'
      };
    } catch (error) {
      console.error('❌ Hint provision error:', error);
      return {
        message: `I'm having trouble providing a hint. Type "solution" to see the answer.`,
        nextState: 'practice_active'
      };
    }
  },

  /**
   * Show solution for current question
   *
   * @param {Object} user - User object
   * @param {Object} question - Question object
   * @param {Object} context - Practice context
   * @returns {Object} Response object
   */
  async showSolution(user, question, context) {
    try {
      // Update context to indicate solution shown
      const newContext = {
        ...context,
        solutionShown: true
      };

      // Update user state
      await updateUser(user.id, {
        practice_context: JSON.stringify(newContext),
        last_active_at: new Date().toISOString()
      });

      // Format solution
      const formattedSolution = practiceService.formatSolution(question, {
        dayNumber: context.dayNumber,
        questionNumber: context.questionNumber,
        totalQuestions: context.totalQuestions
      });

      return {
        message: formattedSolution,
        nextState: 'practice_solution'
      };
    } catch (error) {
      console.error('❌ Solution display error:', error);
      return {
        message: `I'm having trouble showing the solution. Please try again or type "skip" to move to another question.`,
        nextState: 'practice_active'
      };
    }
  },

  /**
   * Skip current question
   *
   * @param {Object} user - User object
   * @param {Object} question - Question object
   * @param {Object} context - Practice context
   * @returns {Object} Response object
   */
  async skipQuestion(user, question, context) {
    try {
      // Update attempt record as skipped
      if (user.current_attempt_id) {
        await executeQuery(async (supabase) => {
          await supabase
            .from('practice_attempts')
            .update({
              status: 'skipped',
              updated_at: new Date().toISOString()
            })
            .eq('id', user.current_attempt_id);
        });
      }

      // Check if we should continue with more questions
      if (context.studyPlanId) {
        // We're in a study plan - get next question
        return await this.getNextStudyPlanQuestion(user, context);
      } else {
        // Stand-alone practice - offer another question
        return await this.offerNextQuestion(user, question.topic, question.difficulty);
      }
    } catch (error) {
      console.error('❌ Question skip error:', error);
      return {
        message: `I'm having trouble skipping this question. Type "menu" to return to the main menu.`,
        nextState: 'welcome'
      };
    }
  },

  /**
   * Record understanding rating and move to next question
   *
   * @param {Object} user - User object
   * @param {Object} question - Question object
   * @param {number} rating - Understanding rating 1-5
   * @param {Object} context - Practice context
   * @returns {Object} Response object
   */
  async recordUnderstandingRating(user, question, rating, context) {
    try {
      // Update attempt record with rating
      if (user.current_attempt_id) {
        await practiceService.updateQuestionAttempt(user.current_attempt_id, rating);
      }

      // Get an encouraging message based on rating
      let encouragement = '';
      if (rating >= 4) {
        encouragement = `Great job! Your understanding is strong. 💪`;
      } else if (rating >= 3) {
        encouragement = `Good progress! Keep building your understanding. 👍`;
      } else {
        encouragement = `Thanks for your honest assessment. We'll keep working on this topic. 🌱`;
      }

      // Check if we should continue with more questions
      if (context.studyPlanId) {
        // We're in a study plan - get next question
        const nextQuestion = await this.getNextStudyPlanQuestion(user, context);
        return {
          message: `${encouragement}\n\n${nextQuestion.message}`,
          nextState: nextQuestion.nextState
        };
      } else {
        // Stand-alone practice - offer another question
        const nextQuestionOffer = await this.offerNextQuestion(
          user,
          question.topic,
          question.difficulty,
          rating
        );
        return {
          message: `${encouragement}\n\n${nextQuestionOffer.message}`,
          nextState: nextQuestionOffer.nextState
        };
      }
    } catch (error) {
      console.error('❌ Understanding rating error:', error);
      return {
        message: `Thanks for your rating! Type "practice" for another question or "menu" to return to the main menu.`,
        nextState: 'welcome'
      };
    }
  },

  /**
   * Assess user response to question
   *
   * @param {Object} user - User object
   * @param {Object} question - Question object
   * @param {string} response - User's response text
   * @param {Object} context - Practice context
   * @returns {Object} Response object
   */
  async assessResponse(user, question, response, context) {
    try {
      // Use AI to assess understanding from response
      const assessment = await practiceService.assessUnderstanding(user.id, question.id, response);

      // Update attempt record with assessment
      if (user.current_attempt_id) {
        await executeQuery(async (supabase) => {
          await supabase
            .from('practice_attempts')
            .update({
              user_response: response,
              understanding_level: assessment.understanding_level,
              concepts_demonstrated: assessment.key_concepts_demonstrated,
              misconceptions: assessment.misconceptions,
              tutor_feedback: assessment.feedback,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.current_attempt_id);
        });
      }

      // Format feedback message
      let feedbackMessage = `💬 **Feedback on your response**\n\n${assessment.feedback}\n\n`;

      // Add solution offer
      feedbackMessage += `Would you like to see the complete solution? Type "solution" to view it.`;

      return {
        message: feedbackMessage,
        nextState: 'practice_active'
      };
    } catch (error) {
      console.error('❌ Response assessment error:', error);
      return {
        message: `Thanks for your response! Type "solution" to see the complete solution.`,
        nextState: 'practice_active'
      };
    }
  },

  /**
   * Get next question in study plan
   *
   * @param {Object} user - User object
   * @param {Object} context - Practice context
   * @returns {Object} Response object
   */
  async getNextStudyPlanQuestion(user, context) {
    try {
      // Check if we have more questions in this day's plan
      if (
        context.questionNumber &&
        context.totalQuestions &&
        context.questionNumber < context.totalQuestions
      ) {
        // Get study plan
        const { session, plan } = await executeQuery(async (supabase) => {
          const { data: sessionData } = await supabase
            .from('exam_prep_sessions')
            .select('*')
            .eq('id', context.sessionId)
            .single();

          if (!sessionData || !sessionData.study_plan_id) {
            return { session: null, plan: null };
          }

          const { data: planData } = await supabase
            .from('study_plans')
            .select('*')
            .eq('id', sessionData.study_plan_id)
            .single();

          return { session: sessionData, plan: planData };
        });

        if (!plan || !plan.plan_data) {
          throw new Error('Study plan not found');
        }

        // Get current day plan
        const dayNumber = context.dayNumber || 1;
        const nextQuestionNumber = (context.questionNumber || 0) + 1;

        const dayPlan = plan.plan_data.days.find((d) => d.day === dayNumber);
        if (
          !dayPlan ||
          !dayPlan.practice_questions ||
          nextQuestionNumber > dayPlan.practice_questions.length
        ) {
          // No more questions for today - complete the day
          return {
            message: `You've completed all practice questions for today! Type "done" to finish today's session.`,
            nextState: 'study_completed'
          };
        }

        // Get next question
        const nextQuestion = dayPlan.practice_questions[nextQuestionNumber - 1];

        // Start practice with next question
        const nextPractice = await this.startPractice(user, {
          questionId: nextQuestion.id,
          topic: nextQuestion.topic,
          sessionId: context.sessionId,
          studyPlanId: plan.id,
          dayNumber: dayNumber,
          questionNumber: nextQuestionNumber,
          totalQuestions: dayPlan.practice_questions.length
        });

        return {
          message: nextPractice,
          nextState: 'practice_active'
        };
      }

      // No more questions in plan - offer to complete
      return {
        message: `You've completed all practice questions for today! Type "done" to finish today's session.`,
        nextState: 'study_completed'
      };
    } catch (error) {
      console.error('❌ Next study plan question error:', error);
      return {
        message: `I'm having trouble finding the next question in your study plan. Type "menu" to return to the main menu.`,
        nextState: 'welcome'
      };
    }
  },

  /**
   * Offer next question outside of study plan
   *
   * @param {Object} user - User object
   * @param {string} topic - Current topic
   * @param {string} difficulty - Current difficulty
   * @param {number} understanding - User's understanding rating
   * @returns {Object} Response object
   */
  async offerNextQuestion(user, topic, difficulty = 'medium', understanding = 3) {
    try {
      // Generate feedback on progress
      const progressFeedback = await practiceService.generateProgressFeedback(user.id, topic);

      // Offer next question
      const message =
        `${progressFeedback}\n\n` +
        `Would you like another ${topic} question?\n\n` +
        `• Reply "yes" for another question\n` +
        `• Reply "change topic" to practice a different topic\n` +
        `• Reply "menu" to return to the main menu`;

      // Update user state with next question parameters
      await updateUser(user.id, {
        practice_context: JSON.stringify({
          topic,
          difficulty,
          lastUnderstanding: understanding,
          awaitingNextQuestion: true
        }),
        current_question_id: null,
        current_attempt_id: null,
        last_active_at: new Date().toISOString()
      });

      return {
        message,
        nextState: 'practice_offer'
      };
    } catch (error) {
      console.error('❌ Next question offer error:', error);
      return {
        message: `Would you like to try another practice question? Reply "yes" or "menu".`,
        nextState: 'practice_offer'
      };
    }
  },

  /**
   * Handle response to next question offer
   *
   * @param {Object} user - User object
   * @param {string} response - User response
   * @returns {Object} Response object
   */
  async handleNextQuestionResponse(user, response) {
    try {
      // Parse context
      let context = {};
      try {
        context = user.practice_context ? JSON.parse(user.practice_context) : {};
      } catch (e) {
        context = {};
      }

      if (!context.awaitingNextQuestion) {
        // Not waiting for next question response
        return {
          message: `I'm not sure what you'd like to do. Type "practice" to start practicing or "menu" to see the main menu.`,
          nextState: 'welcome'
        };
      }

      const normalizedResponse = response.toLowerCase().trim();

      if (normalizedResponse === 'yes' || normalizedResponse === 'practice') {
        // User wants another question
        // Get a question with appropriate difficulty based on prior understanding
        const nextDifficulty = practiceService.calculateNextDifficulty(
          context.difficulty || 'medium',
          context.lastUnderstanding || 3
        );

        // Get next appropriate question
        const nextQuestion = await practiceService.getNextAppropriateQuestion(
          user.id,
          context.topic,
          context.difficulty,
          context.lastUnderstanding
        );

        // Start practice with this question
        const practiceStart = await this.startPractice(user, {
          questionId: nextQuestion.id,
          topic: nextQuestion.topic,
          difficulty: nextQuestion.difficulty
        });

        return {
          message: practiceStart,
          nextState: 'practice_active'
        };
      } else if (normalizedResponse === 'change topic' || normalizedResponse === 'topic') {
        // User wants to change topic
        return {
          message:
            `What topic would you like to practice? Choose from:\n\n` +
            `• Algebra\n` +
            `• Geometry\n` +
            `• Trigonometry\n` +
            `• Functions\n` +
            `• Calculus\n` +
            `• Statistics\n\n` +
            `Or type a specific topic you'd like to work on.`,
          nextState: 'topic_selection'
        };
      } else {
        // Default to main menu
        return {
          message: MESSAGES.WELCOME.MAIN_MENU,
          nextState: 'welcome'
        };
      }
    } catch (error) {
      console.error('❌ Next question response error:', error);
      return {
        message: MESSAGES.WELCOME.MAIN_MENU,
        nextState: 'welcome'
      };
    }
  },

  /**
   * Handle topic selection
   *
   * @param {Object} user - User object
   * @param {string} topic - Selected topic
   * @returns {Object} Response object
   */
  async handleTopicSelection(user, topic) {
    try {
      // Normalize topic
      let normalizedTopic = topic.toLowerCase().trim();

      // Map common topic variations
      const topicMap = {
        algebra: 'algebra',
        algebraic: 'algebra',
        equations: 'algebra',

        geometry: 'geometry',
        geometric: 'geometry',
        shapes: 'geometry',

        trig: 'trigonometry',
        trigonometry: 'trigonometry',
        triangles: 'trigonometry',

        function: 'functions',
        functions: 'functions',
        graphs: 'functions',

        calc: 'calculus',
        calculus: 'calculus',
        derivatives: 'calculus',

        stats: 'statistics',
        statistics: 'statistics',
        probability: 'statistics',
        data: 'statistics'
      };

      // Try to map to a known topic
      normalizedTopic = topicMap[normalizedTopic] || normalizedTopic;

      // Start practice with selected topic
      const practiceStart = await this.startPractice(user, {
        topic: normalizedTopic,
        difficulty: 'medium'
      });

      return {
        message: practiceStart,
        nextState: 'practice_active'
      };
    } catch (error) {
      console.error('❌ Topic selection error:', error);
      return {
        message:
          `I'm having trouble with that topic. Let's try algebra practice instead.\n\n` +
          (await this.startPractice(user, { topic: 'algebra' })),
        nextState: 'practice_active'
      };
    }
  }
};
