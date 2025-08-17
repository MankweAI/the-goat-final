/**
 * Exam Prep Handler - COMPLETE REWRITE with All Bug Fixes
 * Date: 2025-08-17 15:36:12 UTC
 * CRITICAL FIXES:
 * - Enhanced date parsing with dateParser integration
 * - Fixed topic switching functionality
 * - Added proper plan action handling
 * - Context-aware lesson menus
 * - Comprehensive state management
 */

import { executeQuery } from '../config/database.js';
import { updateUser } from '../services/userService.js';
import { questionService } from '../services/questionService.js';
import { formatQuestion } from '../utils/questionFormatter.js';
import { CONSTANTS, MESSAGES } from '../config/constants.js';
import { dateParser } from '../utils/dateParser.js';
import MenuRenderer from '../utils/menuRenderer.js';

export const examPrepHandler = {
  // Entry point - simplified flow
    async startExamPrep(user) {
        try {
                console.log(`📅 Starting exam prep for user ${user.id}`);

                const session = await getOrCreateExamPrepSession(user.id);

                // Check if we have grade
                if (!user.grade) {
                  session.session_state = { step: 'ask_grade' };
                  await saveSession(session);
                  await markUserInExamPrepFlow(user.id, session.id, 'exam_prep_grade');

                  return MESSAGES.WELCOME.GRADE_PROMPT;
                }

                // Go straight to subject selection
                session.session_state = { step: 'ask_subject' };
                await saveSession(session);
                await markUserInExamPrepFlow(user.id, session.id, 'exam_prep_subject');

                return `${MESSAGES.EXAM_PREP.VALIDATION_RESPONSE}\n\n${MESSAGES.EXAM_PREP.SUBJECT_PROMPT}`;
        } catch (error) {
            console.error('❌ Exam prep setup failed:', error);
            return 'Eish, something went wrong setting up exam prep. Try again in a moment! 🫶';
        }
  },

  // Handle menu choices in exam prep flow
  async handleExamPrepMenu(user, choice) {
    const session = await getOrCreateExamPrepSession(user.id);
    const state = session.session_state || {};
    const step = state.step || 'ask_subject';

    console.log(`📅 Exam prep flow: step=${step}, choice=${choice}`);

    if (step === 'ask_subject') {
      // All lead to math for MVP, but acknowledge their choice
      const subjectNames = { 1: 'Mathematics', 2: 'Physics', 3: 'Chemistry', 4: 'Life Sciences' };
      const chosenName = subjectNames[choice] || 'Mathematics';

      if (choice !== 1) {
        session.requested_subject = chosenName;
      }

      session.focus_subject = 'math';
      session.chosen_subject_name = chosenName;
      session.current_topic = 'calculus'; // Default topic

      // Move to exam date step
      session.session_state = { step: 'ask_exam_date' };
      await saveSession(session);
      await updateUser(user.id, { current_menu: 'exam_prep_exam_date' });

      const response =
        choice !== 1
          ? `I hear you about ${chosenName}. Let's start with Maths foundations—they help with all subjects.\n\n`
          : `Great choice. Let's focus on Maths for your exam.\n\n`;

      return response + MESSAGES.EXAM_PREP.EXAM_DATE_PROMPT;
    }

    if (step === 'plan_decision') {
      if (choice === 1) {
        // Yes to plan
        if (session.exam_hours_away > 3) {
          session.session_state = { step: 'ask_preferred_time' };
          await saveSession(session);
          await updateUser(user.id, { current_menu: 'exam_prep_time' });
          return MESSAGES.EXAM_PREP.TIME_PROMPT;
        } else {
          session.plan_opt_in = true;
          session.session_state = { step: 'show_plan' };
          await saveSession(session);
          return await this.showExamPlan(user, session);
        }
      } else {
        // No to plan - go straight to review
        session.plan_opt_in = false;
        session.session_state = { step: 'show_plan' };
        await saveSession(session);
        return await this.showExamPlan(user, session);
      }
    }

    return `Please choose a valid option from the menu above. 🎯`;
  },

  // CRITICAL FIX: Handle text input with enhanced date parsing
  async handleExamPrepText(user, text) {
    const session = await getOrCreateExamPrepSession(user.id);
    const state = session.session_state || {};
    const step = state.step;

    console.log(`📝 Exam prep text input: step=${step}, text="${text.substring(0, 50)}"`);

    if (step === 'ask_grade') {
      // Handle grade input
      const grade = text.trim().toLowerCase();
      if (!CONSTANTS.VALID_GRADES.includes(grade)) {
        return `Please enter a valid grade: 10, 11, or varsity. 🎓`;
      }

      await updateUser(user.id, { grade });
      session.session_state = { step: 'ask_subject' };
      await saveSession(session);
      await updateUser(user.id, { current_menu: 'exam_prep_subject' });

      return `Grade ${grade} noted! 📚\n\n${MESSAGES.EXAM_PREP.SUBJECT_PROMPT}`;
    }

    if (step === 'ask_exam_date' || user.current_menu === 'exam_prep_exam_date') {
      // FIXED: Use enhanced date parser
      const parseResult = dateParser.parseExamDate(text);

      if (!parseResult.success) {
        // Parsing failed - show helpful error
        console.log(`❌ Date parsing failed for: "${text}"`);
        return `${parseResult.message}\n\nTry again or type "skip" if you're not sure. ⏳`;
      }

      if (parseResult.isSkipped) {
        // User skipped date
        session.exam_date = null;
        session.exam_hours_away = null;
        session.session_state = { step: 'show_plan' };
        await saveSession(session);
        await updateUser(user.id, { current_menu: 'exam_prep_plan' });

        console.log(`⏭️ User ${user.id} skipped exam date`);
        return `${parseResult.message}\n\n${await this.showExamPlan(user, session)}`;
      }

      // Successfully parsed date
      session.exam_date = parseResult.date;
      session.exam_hours_away = parseResult.hoursAway;
      session.session_state = { step: 'show_plan' };
      await saveSession(session);
      await updateUser(user.id, { current_menu: 'exam_prep_plan' });

      console.log(
        `✅ Exam date set for user ${user.id}: ${parseResult.confirmation}, ${parseResult.hoursAway}h away`
      );

      // Show confirmation and plan
      const confirmationMessage = `I understood: ${parseResult.confirmation}\n\n`;
      return `${confirmationMessage}${await this.showExamPlan(user, session)}`;
    }

    if (step === 'ask_preferred_time') {
      // Handle time preference
      session.preferred_time = text.trim();
      session.plan_opt_in = true;
      session.session_state = { step: 'show_plan' };
      await saveSession(session);
      await updateUser(user.id, { current_menu: 'exam_prep_plan' });

      return `Perfect! I'll remind you at ${session.preferred_time} each day. 📅\n\n${await this.showExamPlan(user, session)}`;
    }

    // Handle other text input steps...
    return `I didn't understand that input. Type "menu" to go back to the main menu. ✨`;
  },

  // CRITICAL FIX: Added missing plan action handler
  async handleExamPrepPlanAction(user, action) {
    console.log(`📋 Exam prep plan action: ${action} for user ${user.id}`);

    const session = await getOrCreateExamPrepSession(user.id);

    switch (action) {
      case 'begin_review':
        // Start the lesson with exam context
        return await this.startExamLesson(user, session);

      case 'switch_topic':
        // FIXED: Properly handle topic switching
        return await this.handleTopicSwitch(user, session);

      case 'main_menu':
        await updateUser(user.id, {
          current_menu: 'welcome',
        });
        return MESSAGES.WELCOME.MAIN_MENU;

      default:
        console.warn(`Unknown plan action: ${action}`);
        return await this.showExamPlan(user, session);
    }
  },

  // FIXED: Proper topic switching implementation
  async handleTopicSwitch(user, session) {
    console.log(
      `🔄 Switching topics for user ${user.id}, current: ${session.current_topic || 'calculus'}`
    );

    // Toggle between available topics
    const currentTopic = session.current_topic || 'calculus';
    const availableTopics = ['calculus', 'trigonometry', 'algebra'];
    const currentIndex = availableTopics.indexOf(currentTopic);
    const newTopic = availableTopics[(currentIndex + 1) % availableTopics.length];

    // Update session with new topic
    session.current_topic = newTopic;
    session.session_state = {
      ...session.session_state,
      step: 'show_plan',
      topic_switched: true
    };

    await saveSession(session);

    // Update user menu state to plan (not lesson)
    await updateUser(user.id, {
      current_menu: 'exam_prep_plan'
    });

    // Log the switch for observability
    console.log(`✅ Topic switched: ${currentTopic} → ${newTopic} for user ${user.id}`);

    // Show updated plan with new topic
    return await this.showExamPlan(user, session, {
      topicSwitched: true,
      previousTopic: currentTopic,
      newTopic: newTopic
    });
  },

  // Enhanced plan display with topic context
  async showExamPlan(user, session, options = {}) {
    const topic = session.current_topic || 'calculus';
    const topicConfig = CONSTANTS.TOPICS[topic.toUpperCase()];
    const topicDisplay = topicConfig ? topicConfig.display_name : 'Calculus';

    let planHeader = `📅 EXAM PREP PLAN\n\n`;

    if (options.topicSwitched) {
      planHeader += `✅ Switched to ${topicDisplay}!\n\n`;
    }

    planHeader += `📚 Focus: ${topicDisplay}\n`;

    if (session.exam_date) {
      const examDate = new Date(session.exam_date);
      const confirmation = formatExamDate(examDate);
      const hoursAway = session.exam_hours_away || 0;

      planHeader += `⏰ Exam: ${confirmation}`;
      if (hoursAway > 0) {
        planHeader += ` (in ${hoursAway}h)`;
      }
      planHeader += `\n`;
    }

    if (session.plan_opt_in && session.preferred_time) {
      planHeader += `📲 Daily reminder: ${session.preferred_time}\n`;
    }

    planHeader += `\nWhat would you like to do?\n\n`;
    planHeader += MenuRenderer.renderExamPrepPlanMenu();

    return planHeader;
  },

  // Start lesson with proper context
  async startExamLesson(user, session) {
    const topic = session.current_topic || 'calculus';
    const topicConfig = CONSTANTS.TOPICS[topic.toUpperCase()];
    const lessonKey = topicConfig ? topicConfig.lesson_key : 'CALCULUS_INTRO';
    const lessonContent = CONSTANTS.LESSONS[lessonKey];

    if (!lessonContent) {
      return `Lesson content not available yet. Let's do some practice questions instead!\n\nType "practice" to start! 🧮`;
    }

    // Update user to lesson state with exam context
    await updateUser(user.id, {
      current_menu: 'exam_lesson',
      current_lesson_topic: topic
    });

    // Render lesson with exam context menu
    const menuOptions = MenuRenderer.renderLessonMenu('exam');
    const fullLesson = `${lessonContent.content}\n\n${menuOptions}`;

    console.log(`🎓 Started ${topic} lesson for user ${user.id} in exam context`);

    return fullLesson;
  },

  // Handle lesson menu with context
  async handleExamLessonMenu(user, choice) {
    const topic = user.current_lesson_topic || 'calculus';
    const topicConfig = CONSTANTS.TOPICS[topic.toUpperCase()];

    switch (choice) {
      case 1: // Try practice questions
        return await this.startExamPractice(user, topic);

      case 2: // See another example
        const exampleKey = topicConfig ? topicConfig.example_key : 'CALCULUS_EXTRA';
        const example = CONSTANTS.EXAMPLES[exampleKey];
        return MenuRenderer.renderExampleWithMenu(example, 'exam');

      case 3: // Back to plan
        await updateUser(user.id, {
          current_menu: 'exam_prep_plan',
          current_lesson_topic: null
        });
        const session = await getOrCreateExamPrepSession(user.id);
        return await this.showExamPlan(user, session);

      default:
        return `Please choose 1, 2, or 3 from the menu above. 🎯`;
    }
  },

  // Start practice in exam context
  async startExamPractice(user, topic) {
    console.log(`🧮 Starting exam practice for user ${user.id}, topic: ${topic}`);

    // Get a question for the specified topic
    const question = await questionService.getRandomQuestion(user, {
      subject: 'math',
      topic: topic,
      difficulty: calculateUserDifficulty(user),
      excludeRecent: true
    });

    if (!question) {
      return (
        `No practice questions available for ${topic} right now.\n\n` +
        `Try again in a moment, or switch topics. 🌱`
      );
    }

    await questionService.serveQuestionToUser(user.id, question.id);
    await updateUser(user.id, {
      current_menu: 'practice_active',
      exam_practice_context: true,
      last_active_at: new Date().toISOString()
    });

    const topicName = question.topics?.display_name || topic;
    const difficultyEmoji = getDifficultyEmoji(question.difficulty);

    return (
      `📅 ${topicName} Exam Practice ${difficultyEmoji}\n\n` +
      `${formatQuestion(question)}\n\n` +
      `Send A, B, C, or D! 🎯`
    );
  }
};

// Helper functions

async function getOrCreateExamPrepSession(userId) {
  return executeQuery(async (supabase) => {
    // Check for existing active session
    let { data: session, error: fetchError } = await supabase
      .from('panic_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (session) return session;

    // Create new session if none exists
    const { data: newSession, error: createError } = await supabase
      .from('panic_sessions')
      .insert({
        user_id: userId,
        session_type: 'exam_prep',
        status: 'active',
        session_state: { step: 'ask_subject' },
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Session creation failed:', createError);
      throw new Error('Failed to create exam prep session');
    }

    return newSession;
  });
}

async function saveSession(session) {
  return executeQuery(async (supabase) => {
    const { data } = await supabase
      .from('panic_sessions')
      .update({
        session_state: session.session_state,
        focus_subject: session.focus_subject,
        chosen_subject_name: session.chosen_subject_name,
        current_topic: session.current_topic,
        exam_date: session.exam_date,
        exam_hours_away: session.exam_hours_away,
        preferred_time: session.preferred_time,
        plan_opt_in: session.plan_opt_in,
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id)
      .select()
      .single();

    return data;
  });
}

async function markUserInExamPrepFlow(userId, sessionId, currentMenu) {
  await updateUser(userId, {
    current_menu: currentMenu,
    last_active_at: new Date().toISOString()
  });
}

function calculateUserDifficulty(user) {
  // Simple difficulty calculation based on user stats
  const totalAnswered = user.total_questions_answered || 0;
  const accuracy = user.accuracy_percentage || 0;

  if (totalAnswered < 5) return 'basic';
  if (accuracy > 80) return 'advanced';
  if (accuracy > 60) return 'intermediate';
  return 'basic';
}

function getDifficultyEmoji(difficulty) {
  switch (difficulty) {
    case 'basic':
      return '🟢';
    case 'intermediate':
      return '🟡';
    case 'advanced':
      return '🔴';
    default:
      return '🟢';
  }
}

function formatExamDate(date) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
  ];

  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}
