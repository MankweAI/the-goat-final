/**
 * The GOAT - Main Webhook Handler (Enhanced MVP) - COMPLETE REWRITE
 * Date: 2025-08-17 15:52:37 UTC
 * CRITICAL FIXES:
 * - Fixed homework handler method name mismatch
 * - Added all missing exam prep plan action handling
 * - Enhanced text input routing with exam date support
 * - Fixed lesson menu routing with context awareness
 * - Comprehensive error handling and logging
 */

import { findOrCreateUser, updateUserActivity, updateUser } from './services/userService.js';
import { parseCommand, isExpectingTextInput } from './utils/commandParser.js';
import { formatResponse, formatErrorResponse } from './utils/responseFormatter.js';
import { CONSTANTS, MESSAGES } from './config/constants.js';

import { examPrepHandler } from './handlers/examPrepHandler.js';
import { homeworkHandler } from './handlers/homeworkHandler.js';
import { practiceHandler } from './handlers/practiceHandler.js';
import { conversationalExamPrepHandler } from './handlers/conversationalExamPrepHandler.js';
import { studyPlanHandler } from './handlers/studyPlanHandler.js';
import { aiTutorHandler } from './handlers/aiTutorHandler.js';
import { analyticsHandler } from './handlers/analyticsHandler.js';
import { offlineHandler } from './handlers/offlineHandler.js';


export default async function handler(req, res) {
  const start = Date.now();

  console.log('🚀 THE GOAT v3.1 - ENHANCED MVP: EXAM/HOMEWORK/PRACTICE WITH BUG FIXES');

  if (req.method !== 'POST') {
    return res.status(405).json(
      formatErrorResponse('Only POST requests supported', {
        allowed: ['POST'],
        elapsed_ms: Date.now() - start
      })
    );
  }

  const subscriberId = req.body.subscriber_id || req.body.psid;
  const message = req.body.message;

  if (!subscriberId || !message) {
    return res.status(400).json(
      formatErrorResponse('Missing subscriber_id or message', {
        subscriber_id: subscriberId,
        elapsed_ms: Date.now() - start
      })
    );
  }

  console.log(`📥 Message from ${subscriberId}: "${message.substring(0, 100)}"`);

  try {
    const user = await findOrCreateUser(subscriberId);
    if (!user) {
      throw new Error('Failed to find or create user');
    }

    console.log(
      `👤 User ${user.id} | Menu: ${user.current_menu} | H:${!!user.homework_session_id}`
    );

    await updateUserActivity(user.id);

    const command = parseCommand(message, {
      current_menu: user.current_menu,
      has_current_question: !!user.current_question_id,
      expecting_answer: !!user.current_question_id,
      expecting_text_input: isExpectingTextInput(user.current_menu)
    });

    // Defensive programming - ensure command has required properties
    const safeCommand = {
      type: command.type || 'unrecognized',
      action: command.action || null,
      menuChoice: command.menuChoice || null,
      text: command.text || null,
      answer: command.answer || null,
      validRange: command.validRange || '1-5',
      originalInput: command.originalInput || message,
      ...command
    };

    console.log(`🎯 Command parsed: ${safeCommand.type}`, {
      action: safeCommand.action,
      menuChoice: safeCommand.menuChoice,
      text: safeCommand.text?.substring(0, 30),
      originalInput: safeCommand.originalInput?.substring(0, 50)
    });

    let reply = '';

    try {
      // Extract connection metrics if available
      const connectionData = {
        response_time_ms: req.body.response_time_ms,
        connection_type: req.body.connection_type,
        signal_strength: req.body.signal_strength
      };

      // Check connectivity and suggest offline mode if needed
      const connectivitySuggestion = await offlineHandler.checkConnectivityAndSuggestOffline(
        user,
        connectionData
      );

      if (connectivitySuggestion) {
        // Log connection metrics
        await executeQuery(async (supabase) => {
          await supabase.from('connection_metrics').insert({
            user_id: user.id,
            session_id: req.body.session_id,
            response_time_ms: connectionData.response_time_ms,
            connection_type: connectionData.connection_type,
            signal_strength: connectionData.signal_strength,
            metric_date: new Date().toISOString(),
            created_at: new Date().toISOString()
          });
        });

        // If user sent "continue", proceed normally
        if (safeCommand.text && safeCommand.text.toLowerCase() === 'continue') {
          // Continue with normal flow
        } else {
          // If offline suggestion is needed, return it before processing other commands
          reply = connectivitySuggestion.message;

          // Update user state if it's a suggestion to use offline mode
          if (connectivitySuggestion.suggestionType === 'use_offline') {
            await updateUser(user.id, {
              current_menu: 'offline_ready',
              last_active_at: new Date().toISOString()
            });
          }

          return res.status(200).json({ message: reply });
        }
      }
    } catch (connectionError) {
      console.error('❌ Connection check error:', connectionError);
      // Continue with normal flow if connection check fails
    }
    
    // Route to appropriate handlers
    switch (safeCommand.type) {
      // ===== CORE FLOWS =====

      case 'welcome_menu':
      case 'unrecognized':
        reply = await showWelcomeMenu(user);
        break;

      case CONSTANTS.COMMAND_TYPES.EXAM_PREP:
        if (safeCommand.action === 'start') {
          // Check if user prefers conversation mode
          if (user.prefers_conversation !== false) {
            reply = await conversationalExamPrepHandler.startConversation(user);
          } else {
            reply = await examPrepHandler.startExamPrep(user);
          }
        }
        break;

      case CONSTANTS.COMMAND_TYPES.HOMEWORK:
        if (safeCommand.action === 'start') {
          // CRITICAL FIX: Changed from startHomework to startHomeworkHelp
          reply = await homeworkHandler.startHomeworkHelp(user);
        }
        break;

      case CONSTANTS.COMMAND_TYPES.PRACTICE:
        if (safeCommand.action === 'start') {
          reply = await practiceHandler.startPractice(user);
        }
        break;

      case CONSTANTS.COMMAND_TYPES.ANSWER:
        reply = await handleAnswerSubmission(user, safeCommand.answer);
        break;

      case 'offline_ready':
        const offlineResult = await offlineHandler.handleOfflineInteraction(user, safeCommand.text);
        reply = offlineResult.message;

        // Update user state if needed
        if (offlineResult.nextState && offlineResult.nextState !== user.current_menu) {
          await updateUser(user.id, {
            current_menu: offlineResult.nextState,
            last_active_at: new Date().toISOString()
          });
        }
        break;

      case 'offline_active':
        const offlineActiveResult = await offlineHandler.handleOfflineActiveState(
          user,
          safeCommand.text
        );
        reply = offlineActiveResult.message;

        // Update user state if needed
        if (offlineActiveResult.nextState && offlineActiveResult.nextState !== user.current_menu) {
          await updateUser(user.id, {
            current_menu: offlineActiveResult.nextState,
            last_active_at: new Date().toISOString()
          });
        }
        break;

      case CONSTANTS.COMMAND_TYPES.OFFLINE:
        reply = await offlineHandler.requestOfflinePackage(user, {
          includeTopics: safeCommand.topics ? safeCommand.topics.split(',') : [],
          daysToInclude: safeCommand.days ? parseInt(safeCommand.days) : 3
        });
        break;
      // ===== STUDY PLAN ACTIONS =====
      case 'study_plan_action':
        reply = await studyPlanHandler.handleStudyPlanAction(user, safeCommand.action);
        break;

      case CONSTANTS.COMMAND_TYPES.TUTOR:
        if (safeCommand.topic) {
          // Start tutoring with specified topic
          reply = await aiTutorHandler.startTutoring(user, { topic: safeCommand.topic });
        } else {
          // Check if we should show topic selection or start general tutoring
          const showTopicSelection = safeCommand.action === 'topics';

          if (showTopicSelection) {
            const topics = await aiTutorHandler.getTutoringTopics(user);
            reply = `What topic would you like help with?\n\n• ${topics.join('\n• ')}\n\nOr type any other topic you need help with.`;
            await updateUser(user.id, { current_menu: 'tutor_topic_selection' });
          } else {
            // Start general tutoring
            reply = await aiTutorHandler.startTutoring(user);
          }
        }
        break;

      case 'progress_summary':
        const progressResult = await analyticsHandler.handleProgressInteraction(
          user,
          safeCommand.text
        );
        reply = progressResult.message;

        // Update user state if needed
        if (progressResult.nextState && progressResult.nextState !== user.current_menu) {
          await updateUser(user.id, {
            current_menu: progressResult.nextState,
            last_active_at: new Date().toISOString()
          });
        }
        break;

      case 'topic_report':
        const topicReportResult = await analyticsHandler.handleTopicReportInteraction(
          user,
          safeCommand.text
        );
        reply = topicReportResult.message;

        // Update user state if needed
        if (topicReportResult.nextState && topicReportResult.nextState !== user.current_menu) {
          await updateUser(user.id, {
            current_menu: topicReportResult.nextState,
            last_active_at: new Date().toISOString()
          });
        }
        break;

      // Add command handler for progress
      case CONSTANTS.COMMAND_TYPES.PROGRESS:
        reply = await analyticsHandler.showProgressSummary(user);
        break;

      // Update welcome message to include progress option
      case 'welcome':
        // Check if user has active study plan or recent activity
        const hasActivity = await executeQuery(async (supabase) => {
          const { count, error } = await supabase
            .from('practice_attempts')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id);

          return !error && count > 0;
        });

        if (hasActivity) {
          // Add progress option to welcome menu
          MESSAGES.WELCOME.MAIN_MENU += '\n• Type *progress* to check your study progress';
        }

        reply = MESSAGES.WELCOME.MAIN_MENU;
        break;

      // Also update the conversational exam prep handling to generate plans:
      case 'text_input':
        if (user.current_menu === 'exam_prep_conversation') {
          const conversationResult = await conversationalExamPrepHandler.handleConversationMessage(
            user,
            safeCommand.text
          );

          reply = conversationResult.message;

          // If conversation is complete, generate study plan
          if (conversationResult.conversation_complete) {
            // Get session
            const session = await conversationalExamPrepHandler.getExamPrepSession(user.id);

            if (session) {
              // Generate and show study plan
              const planVisualization = await studyPlanHandler.generateStudyPlan(user, session);
              reply += '\n\n' + planVisualization;

              // Update user state
              await updateUser(user.id, { current_menu: 'study_plan' });
            } else {
              await updateUser(user.id, { current_menu: 'welcome' });
            }
          }

          // If we should restart, reset to traditional flow
          if (conversationResult.shouldRestart) {
            await updateUser(user.id, { current_menu: 'exam_prep_grade' });
          }
        } else {
          // Handle other text inputs as before
          reply = await handleTextInput(user, safeCommand.text);
        }
        break;

      case 'practice_active':
        const practiceResult = await practiceHandler.handlePracticeInteraction(
          user,
          safeCommand.text
        );
        reply = practiceResult.message;

        // Update user state if needed
        if (practiceResult.nextState && practiceResult.nextState !== user.current_menu) {
          await updateUser(user.id, {
            current_menu: practiceResult.nextState,
            last_active_at: new Date().toISOString()
          });
        }
        break;

      case 'practice_solution':
        // Handle understanding rating (1-5)
        if (/^[1-5]$/.test(safeCommand.text)) {
          const ratingResult = await practiceHandler.handlePracticeInteraction(
            user,
            safeCommand.text
          );
          reply = ratingResult.message;

          // Update user state if needed
          if (ratingResult.nextState && ratingResult.nextState !== user.current_menu) {
            await updateUser(user.id, {
              current_menu: ratingResult.nextState,
              last_active_at: new Date().toISOString()
            });
          }
        } else {
          reply = `Please rate your understanding from 1-5, with 5 being complete understanding.`;
        }
        break;

      case 'practice_offer':
        const offerResult = await practiceHandler.handleNextQuestionResponse(
          user,
          safeCommand.text
        );
        reply = offerResult.message;

        // Update user state if needed
        if (offerResult.nextState && offerResult.nextState !== user.current_menu) {
          await updateUser(user.id, {
            current_menu: offerResult.nextState,
            last_active_at: new Date().toISOString()
          });
        }
        break;

      case 'tutor_topic_selection':
        const topicResult = await aiTutorHandler.handleTopicSelection(user, safeCommand.text);
        reply = topicResult.message;

        // Update user state if needed
        if (topicResult.nextState && topicResult.nextState !== user.current_menu) {
          await updateUser(user.id, {
            current_menu: topicResult.nextState,
            last_active_at: new Date().toISOString()
          });
        }
        break;
      case 'tutor_active':
        const tutorResult = await aiTutorHandler.handleTutoringMessage(user, safeCommand.text);
        reply = tutorResult.message;

        // Update user state if needed
        if (tutorResult.nextState && tutorResult.nextState !== user.current_menu) {
          await updateUser(user.id, {
            current_menu: tutorResult.nextState,
            last_active_at: new Date().toISOString()
          });
        }
        break;

      case 'practice_active':
        // Add option to ask tutor for help with current question
        if (
          safeCommand.text.toLowerCase() === 'ask tutor' ||
          safeCommand.text.toLowerCase() === 'help' ||
          safeCommand.text.toLowerCase() === 'tutor help'
        ) {
          // Get current question
          const { currentQuestion, context } = await practiceHandler.getCurrentQuestionData(user);

          if (currentQuestion) {
            // Start tutoring with question context
            reply = await aiTutorHandler.startTutoring(user, {
              topic: currentQuestion.topic,
              questionContext: currentQuestion.question_text,
              startMode: 'question_help'
            });

            await updateUser(user.id, { current_menu: 'tutor_active' });
          } else {
            reply = await practiceHandler.handlePracticeInteraction(user, safeCommand.text);
          }
        } else {
          // Handle normal practice interaction
          const practiceResult = await practiceHandler.handlePracticeInteraction(
            user,
            safeCommand.text
          );
          reply = practiceResult.message;

          // Update user state if needed
          if (practiceResult.nextState && practiceResult.nextState !== user.current_menu) {
            await updateUser(user.id, {
              current_menu: practiceResult.nextState,
              last_active_at: new Date().toISOString()
            });
          }
        }
        break;

      // Add integration with lessons
      case 'lesson_active':
        // Add option to ask tutor about current lesson
        if (
          safeCommand.text.toLowerCase() === 'ask tutor' ||
          safeCommand.text.toLowerCase() === 'help' ||
          safeCommand.text.toLowerCase() === 'tutor help'
        ) {
          // Get current lesson
          const { currentLesson, context } = await lessonDeliveryHandler.getCurrentLessonData(user);

          if (currentLesson) {
            // Start tutoring with lesson context
            reply = await aiTutorHandler.startTutoring(user, {
              topic: currentLesson.topic,
              lessonContext: currentLesson.title,
              startMode: 'lesson_followup'
            });

            await updateUser(user.id, { current_menu: 'tutor_active' });
          } else {
            reply = await lessonDeliveryHandler.handleLessonNavigation(user, safeCommand.text);
          }
        } else {
          // Handle normal lesson navigation
          const lessonNavResult = await lessonDeliveryHandler.handleLessonNavigation(
            user,
            safeCommand.text
          );
          reply = lessonNavResult.message;

          // Update user state if needed
          if (lessonNavResult.nextState && lessonNavResult.nextState !== user.current_menu) {
            await updateUser(user.id, {
              current_menu: lessonNavResult.nextState,
              last_active_at: new Date().toISOString()
            });
          }
        }
        break;

      // Add command handler for standalone practice
      case CONSTANTS.COMMAND_TYPES.PRACTICE:
        // Start practice with specified topic if provided
        const practiceTopic = safeCommand.topic || 'algebra';
        const practiceStart = await practiceHandler.startPractice(user, {
          topic: practiceTopic,
          difficulty: safeCommand.difficulty || 'medium'
        });

        reply = practiceStart;
        break;

      case 'lesson_active':
        const lessonNavResult = await lessonDeliveryHandler.handleLessonNavigation(
          user,
          safeCommand.text
        );
        reply = lessonNavResult.message;

        // Update user state if needed
        if (lessonNavResult.nextState && lessonNavResult.nextState !== user.current_menu) {
          await updateUser(user.id, {
            current_menu: lessonNavResult.nextState,
            last_active_at: new Date().toISOString()
          });
        }
        break;

      case 'lesson_feedback':
        const feedbackResult = await lessonDeliveryHandler.handleLessonFeedbackText(
          user,
          safeCommand.text
        );
        reply = feedbackResult.message;

        // Update user state if needed
        if (feedbackResult.nextState && feedbackResult.nextState !== user.current_menu) {
          await updateUser(user.id, {
            current_menu: feedbackResult.nextState,
            last_active_at: new Date().toISOString()
          });
        }
        break;

      // ===== HANDLE CONVERSATION MESSAGES =====
      case 'text_input':
        if (user.current_menu === 'exam_prep_conversation') {
          const conversationResult = await conversationalExamPrepHandler.handleConversationMessage(
            user,
            safeCommand.text
          );

          reply = conversationResult.message;

          // If conversation is complete, update user state
          if (conversationResult.conversation_complete) {
            await updateUser(user.id, { current_menu: 'exam_prep_plan' });
          }

          // If we should restart, reset to traditional flow
          if (conversationResult.shouldRestart) {
            await updateUser(user.id, { current_menu: 'exam_prep_grade' });
          }
        } else {
          // Handle other text inputs as before
          reply = await handleTextInput(user, safeCommand.text);
        }
        break;

      // ===== EXAM PREP SPECIFIC =====

      case 'exam_prep_subject':
        reply = await examPrepHandler.handleExamPrepMenu(user, safeCommand.menuChoice);
        break;

      // CRITICAL FIX: Added missing exam prep plan action handling
      case 'exam_prep_plan_action':
        reply = await examPrepHandler.handleExamPrepPlanAction(user, safeCommand.action);
        break;

      // CRITICAL FIX: Added exam lesson menu handling
      case 'exam_lesson_menu':
        reply = await examPrepHandler.handleExamLessonMenu(user, safeCommand.menuChoice);
        break;

      // ===== HOMEWORK SPECIFIC =====

      case 'homework_subject':
        reply = await homeworkHandler.handleHomeworkMenu(user, safeCommand.menuChoice);
        break;

      case 'homework_lesson_menu':
        reply = await homeworkHandler.handleHomeworkLessonMenu(user, safeCommand.menuChoice);
        break;

      // ===== PRACTICE SPECIFIC =====

      case 'practice_continue':
        reply = await practiceHandler.handlePracticeContinue(user, safeCommand.action);
        break;

      // ===== TEXT INPUT HANDLING =====

      case 'text_input':
        reply = await handleTextInput(user, safeCommand.text);
        break;

      // ===== ERROR HANDLING =====

      case 'invalid_answer':
        reply = MESSAGES.ERRORS.INVALID_ANSWER;
        break;

      case 'invalid_option':
        reply = `${MESSAGES.ERRORS.INVALID_MENU_OPTION}\n\nValid range: ${safeCommand.validRange}`;
        break;

      default:
        console.warn(`⚠️ Unhandled command type: ${safeCommand.type}`);
        reply = await showWelcomeMenu(user);
        break;
    }

    console.log(`✅ Reply generated (${reply.length} chars)`);

    // Update user's last interaction
    await updateUser(user.id, {
      last_active_at: new Date().toISOString()
    });

    return res.status(200).json(
      formatResponse(reply, {
        user_id: user.id,
        command_type: safeCommand.type,
        elapsed_ms: Date.now() - start
      })
    );
  } catch (error) {
    console.error('❌ Handler error:', error);

    const errorReply =
      process.env.NODE_ENV === 'development' ? `Error: ${error.message}` : MESSAGES.ERRORS.GENERIC;

    return res.status(500).json(
      formatErrorResponse(errorReply, {
        error: error.message,
        elapsed_ms: Date.now() - start
      })
    );
  }
}

// ===== HELPER FUNCTIONS =====

async function showWelcomeMenu(user) {
  console.log(`🏠 Showing welcome menu to user ${user.id}`);

  await updateUser(user.id, {
    current_menu: 'welcome',
    current_question_id: null,
    homework_session_id: null
  });

  return MESSAGES.WELCOME.MAIN_MENU;
}

async function handleAnswerSubmission(user, answer) {
  console.log(`📝 Answer submission from user ${user.id}: ${answer}`);

  if (!user.current_question_id) {
    return MESSAGES.ERRORS.NO_QUESTION_ACTIVE;
  }

  // Determine context based on current menu
  const context = user.current_menu;

  if (context === 'practice_active') {
    return await practiceHandler.handlePracticeAnswer(user, answer);
  } else if (context === 'exam_practice_active' || user.exam_practice_context) {
    return await examPrepHandler.handleExamPracticeAnswer(user, answer);
  } else if (context === 'homework_practice_active') {
    return await homeworkHandler.handleHomeworkPracticeAnswer(user, answer);
  } else {
    // Default to practice handler
    return await practiceHandler.handlePracticeAnswer(user, answer);
  }
}

async function handleTextInput(user, text) {
  console.log(`📝 Text input from user ${user.id}: "${text.substring(0, 50)}"`);

  const currentMenu = user.current_menu;

  switch (currentMenu) {
    // ===== EXAM PREP TEXT INPUTS =====

    case 'exam_prep_grade':
    case 'exam_prep_exam_date':
    case 'exam_prep_problems':
    case 'exam_prep_time':
      return await examPrepHandler.handleExamPrepText(user, text);

    // ===== HOMEWORK TEXT INPUTS =====

    case 'homework_grade':
    case 'homework_subject':
    case 'homework_confusion':
      return await homeworkHandler.handleHomeworkText(user, text);

    // ===== GENERAL GRADE INPUT =====

    case 'ask_grade':
      return await handleGradeInput(user, text);

    default:
      console.warn(`⚠️ Unhandled text input menu: ${currentMenu}`);
      return `I didn't understand that input. Type "menu" to go back to the main menu. ✨`;
  }
}

async function handleGradeInput(user, text) {
  const grade = text.trim().toLowerCase();

  if (!CONSTANTS.VALID_GRADES.includes(grade)) {
    return `Please enter a valid grade: 10, 11, or varsity. 🎓`;
  }

  await updateUser(user.id, {
    grade,
    current_menu: 'welcome'
  });

  return `Grade ${grade} saved! 📚\n\n${MESSAGES.WELCOME.MAIN_MENU}`;
}

// Export utility functions for testing
export {
  showWelcomeMenu,
  handleAnswerSubmission,
  handleTextInput,
  formatResponse,
  formatErrorResponse
};
