/**
 * Exam Prep Handler - FIXED Date Parsing + UX Improvements
 * Date: 2025-08-17 13:24:35 UTC
 * CRITICAL FIXES: Date parsing, subject selection, follow-up questions, personalization
 */

import { executeQuery } from '../config/database.js';
import { updateUser } from '../services/userService.js';
import { questionService } from '../services/questionService.js';
import { aiService } from '../services/aiService.js';
import { formatQuestion } from '../utils/questionFormatter.js';
import { CONSTANTS, MESSAGES } from '../config/constants.js';

export const examPrepHandler = {
  // Entry point - simplified flow
  async startExamPrep(user) {
    const session = await getOrCreateExamPrepSession(user.id);

    // Check if we have grade
    if (!user.grade) {
      session.session_state = { step: 'ask_grade' };
      await saveSession(session);
      await markUserInExamPrepFlow(user.id, session.id, 'exam_prep_grade');

      return MESSAGES.WELCOME.GRADE_PROMPT;
    }

    // Go straight to problem details (skip subject selection for MVP)
    session.session_state = { step: 'ask_problem_details' };
    await saveSession(session);
    await markUserInExamPrepFlow(user.id, session.id, 'exam_prep_problems');

    return `${MESSAGES.EXAM_PREP.VALIDATION_RESPONSE}\n\n${generateProblemDetailsPrompt()}`;
  },

  // Handle menu choices in exam prep flow (simplified - no subject selection)
  async handleExamPrepMenu(user, choice) {
    const session = await getOrCreateExamPrepSession(user.id);
    const state = session.session_state || {};
    const step = state.step || 'ask_problem_details';

    console.log(`📅 Exam prep flow: step=${step}, choice=${choice}`);

    if (step === 'plan_decision') {
      if (choice === 1) {
        // Yes to plan
        if (session.exam_hours_away && session.exam_hours_away > 3) {
          session.session_state = { step: 'ask_preferred_time' };
          await saveSession(session);
          await updateUser(user.id, { current_menu: 'exam_prep_time' });
          return MESSAGES.EXAM_PREP.TIME_PROMPT;
        } else {
          session.plan_opt_in = true;
          session.session_state = { step: 'show_plan_short' };
          await saveSession(session);
          return await generateShortPlan(session);
        }
      } else {
        // No to plan
        session.plan_opt_in = false;
        session.session_state = { step: 'show_plan_short' };
        await saveSession(session);
        return await generateShortPlan(session);
      }
    }

    return `I didn't catch that. Let's try again. 🌱`;
  },

  // Handle exam prep plan actions
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
          panic_session_id: null
        });
        return MESSAGES.WELCOME.MAIN_MENU;

      default:
        console.warn(`Unknown plan action: ${action}`);
        return await this.showExamPlan(user, session);
    }
  },

  // Handle text inputs for exam prep
  async handleExamPrepText(user, text) {
    const session = await getOrCreateExamPrepSession(user.id);
    const state = session.session_state || {};

    console.log(`📝 Exam prep text: step="${state.step}", input="${text.substring(0, 50)}"`);

    // Handle grade input
    if (state.step === 'ask_grade') {
      const lowerText = text.toLowerCase().trim();

      if (['10', '11', 'varsity'].includes(lowerText)) {
        await updateUser(user.id, { grade: lowerText });

        session.session_state = { step: 'ask_problem_details' };
        await saveSession(session);
        await markUserInExamPrepFlow(user.id, session.id, 'exam_prep_problems');

        return `${MESSAGES.EXAM_PREP.VALIDATION_RESPONSE}\n\n${generateProblemDetailsPrompt()}`;
      } else {
        return `Please choose 10, 11, or varsity for your grade. 🎓`;
      }
    }

    // ENHANCED: Handle problem details with follow-up questions
    if (state.step === 'ask_problem_details') {
      return await this.processEnhancedProblemDescription(user, session, text);
    }

    // Handle follow-up responses
    if (state.step === 'ask_followup') {
      return await this.processFollowUpResponse(user, session, text);
    }

    // FIXED: Handle exam date input with enhanced parsing
    if (state.step === 'ask_exam_date') {
      const lowerText = text.toLowerCase().trim();

      if (lowerText === 'skip') {
        session.exam_date = null;
        session.exam_hours_away = null;
        session.session_state = { step: 'show_plan_short' };
        await saveSession(session);
        await updateUser(user.id, { current_menu: 'exam_prep_plan' });
        return await generateShortPlan(session);
      }

      const examDate = parseEnhancedDateString(text);
      if (examDate) {
        session.exam_date = examDate.toISOString();
        session.exam_hours_away = Math.max(0, (examDate - new Date()) / (1000 * 60 * 60));

        session.session_state = { step: 'plan_decision' };
        await saveSession(session);
        await updateUser(user.id, { current_menu: 'exam_prep_plan_decision' });

        if (session.exam_hours_away > 3) {
          return MESSAGES.EXAM_PREP.PLAN_OFFER_LONG;
        } else {
          return MESSAGES.EXAM_PREP.PLAN_OFFER_SHORT;
        }
      } else {
        return `I didn't catch the date. Try formats like:\n• "22 Aug 2pm"\n• "tomorrow 3pm"\n• "next Monday"\n• "in 3 days"\n\nOr say "skip" if you're not sure. ⏳`;
      }
    }

    // Handle preferred time input
    if (state.step === 'ask_preferred_time') {
      const timeMatch = text.match(/(\d{1,2})\s*([ap]m)?/i);
      if (timeMatch) {
        const hour = parseInt(timeMatch[1]);
        const isPM = timeMatch[2]?.toLowerCase() === 'pm';
        const hour24 = isPM && hour !== 12 ? hour + 12 : !isPM && hour === 12 ? 0 : hour;

        session.preferred_daily_time = `${hour24.toString().padStart(2, '0')}:00`;
        session.plan_opt_in = true;
        session.session_state = { step: 'show_plan_long' };
        await saveSession(session);
        await updateUser(user.id, { current_menu: 'exam_prep_plan' });

        return await generateLongPlan(session);
      } else {
        return `Try a time like "7pm" or "19:00". ⏰`;
      }
    }

    return `I didn't catch that. Type "menu" to start over. 🌱`;
  },

  // ENHANCED: Process problem description with AI analysis and follow-up questions
  async processEnhancedProblemDescription(user, session, problemText) {
    try {
      console.log(`🔍 Enhanced problem analysis for user ${user.id}`);

      // Analyze the problem using AI
      const analysis = await aiService.analyzeStudentProblem(
        {
          id: user.id,
          grade: user.grade,
          username: user.username
        },
        problemText,
        {
          stress_level: 3, // Default for exam prep
          subject_choice: 'math'
        }
      );

      // Store analysis in session for lesson personalization
      session.problem_analysis = analysis;
      session.original_problem_text = problemText;

      console.log(`📊 Analysis result:`, {
        clarity: analysis.clarity_level,
        concepts: analysis.concepts,
        needsFollowup: analysis.follow_up_needed
      });

      // If problem is vague, ask follow-up questions
      if (analysis.clarity_level === 'needs_followup' && analysis.follow_up_needed) {
        const followUpQuestion = await aiService.generateFollowUpQuestion(
          {
            id: user.id,
            grade: user.grade,
            username: user.username
          },
          analysis
        );

        session.session_state = { step: 'ask_followup' };
        session.followup_question = followUpQuestion;
        await saveSession(session);

        return `I understand you're worried about your exam. 🌱\n\n${followUpQuestion}`;
      }

      // Problem is clear enough, move to exam date
      session.session_state = { step: 'ask_exam_date' };
      await saveSession(session);
      await updateUser(user.id, { current_menu: 'exam_prep_exam_date' });

      const conceptList =
        analysis.concepts.length > 0 ? analysis.concepts.join(', ') : 'your maths concepts';

      return `Got it! I can see you're struggling with **${conceptList}**. Let's create a focused study plan.\n\n${MESSAGES.EXAM_PREP.EXAM_DATE_PROMPT}`;
    } catch (error) {
      console.error('❌ Enhanced problem description processing failed:', error);

      // Fallback to simple flow
      session.session_state = { step: 'ask_exam_date' };
      await saveSession(session);
      await updateUser(user.id, { current_menu: 'exam_prep_exam_date' });

      return `Let's build a focused study plan for your exam.\n\n${MESSAGES.EXAM_PREP.EXAM_DATE_PROMPT}`;
    }
  },

  // NEW: Process follow-up responses to refine understanding
  async processFollowUpResponse(user, session, followUpText) {
    try {
      console.log(`🎯 Processing follow-up response for user ${user.id}`);

      // Refine the analysis based on follow-up response
      const refinedAnalysis = await aiService.refineAnalysis(
        session.problem_analysis,
        followUpText,
        {
          id: user.id,
          grade: user.grade,
          username: user.username
        }
      );

      // Update session with refined analysis
      session.problem_analysis = refinedAnalysis;
      session.followup_response = followUpText;

      // Move to exam date
      session.session_state = { step: 'ask_exam_date' };
      await saveSession(session);
      await updateUser(user.id, { current_menu: 'exam_prep_exam_date' });

      const specificGap = refinedAnalysis.specific_gap || 'your maths challenges';

      return `Perfect! Now I understand your specific challenge with **${specificGap}**. Let's create a targeted study plan.\n\n${MESSAGES.EXAM_PREP.EXAM_DATE_PROMPT}`;
    } catch (error) {
      console.error('❌ Follow-up processing failed:', error);

      // Fallback
      session.session_state = { step: 'ask_exam_date' };
      await saveSession(session);
      await updateUser(user.id, { current_menu: 'exam_prep_exam_date' });

      return `Thanks for clarifying! Let's build your study plan.\n\n${MESSAGES.EXAM_PREP.EXAM_DATE_PROMPT}`;
    }
  },

  // ENHANCED: Start personalized lesson based on problem analysis
  async startPersonalizedLesson(user, session) {
    try {
      const analysis = session.problem_analysis;
      let topic = session.current_topic || 'calculus';
      let lessonContent = '';

      await updateUser(user.id, { current_menu: 'lesson' });

      // Customize lesson based on user's specific problems
      if (analysis && analysis.concepts.length > 0) {
        const userConcepts = analysis.concepts.join(', ');
        const specificGap = analysis.specific_gap || 'understanding the concepts';

        lessonContent = `🎯 **PERSONALIZED ${topic.toUpperCase()} LESSON**\n\n`;
        lessonContent += `Based on your concerns about **${userConcepts}**, let's focus on **${specificGap}**.\n\n`;

        if (topic === 'calculus') {
          lessonContent += getPersonalizedCalculusLesson(analysis);
        } else {
          lessonContent += getPersonalizedTrigLesson(analysis);
        }
      } else {
        // Fallback to standard lesson
        lessonContent =
          topic === 'calculus'
            ? MESSAGES.LESSONS.CALCULUS_INTRO
            : MESSAGES.LESSONS.TRIGONOMETRY_INTRO;
      }

      return lessonContent;
    } catch (error) {
      console.error('❌ Personalized lesson failed:', error);

      // Fallback to standard lesson
      const topic = session.current_topic || 'calculus';
      await updateUser(user.id, { current_menu: 'lesson' });

      return topic === 'calculus'
        ? MESSAGES.LESSONS.CALCULUS_INTRO
        : MESSAGES.LESSONS.TRIGONOMETRY_INTRO;
    }
  },

  // Rest of methods (unchanged but with fixed context menus)
  async handleLessonAction(user, action) {
    const session = await getOrCreateExamPrepSession(user.id);

    if (action === 'start_practice') {
      return await this.startExamPractice(user, session);
    }

    if (action === 'another_example') {
      const topic = session.current_topic || 'calculus';
      const extraExample = generateExtraExample(topic);
      return `${extraExample}\n\n${MESSAGES.LESSONS.CALCULUS_INTRO.split('1️⃣')[1]}`;
    }

    if (action === 'back_to_main') {
      await endExamPrepSession(session.id);
      await clearExamPrepState(user.id);
      return `Take your time. Say "exam" when you're ready to prep! 📅`;
    }

    return `Pick 1, 2, or 3 from the lesson options. ✨`;
  },

  async startExamPractice(user, session) {
    const topic = session.current_topic || 'calculus';

    const question = await questionService.getQuestionByTopic(user, topic, {
      subject: 'math',
      difficulty: 'easy',
      excludeRecent: true
    });

    if (!question) {
      return `No practice questions available right now. Let's try again later. 🌱`;
    }

    await questionService.serveQuestionToUser(user.id, question.id);
    await updateUser(user.id, { current_menu: 'practice_active' });

    session.session_state = {
      ...session.session_state,
      practice_active: true,
      questions_in_set: 1,
      max_questions: 5,
      current_topic: topic
    };
    await saveSession(session);

    return `📅 Exam prep practice - let's sharpen your skills!\n\n${formatQuestion(question)}`;
  },

  async handleExamPracticeAnswer(user, answerLetter) {
    const session = await getOrCreateExamPrepSession(user.id);
    const state = session.session_state || {};

    if (!state.practice_active || !user.current_question_id) {
      return `Type "practice" to start practicing! 🧮`;
    }

    const { question, correct } = await fetchQuestionAndCheck(
      user.current_question_id,
      answerLetter
    );

    await questionService.recordUserResponse(user.id, question.id, answerLetter, correct, null);

    const feedback = correct
      ? `✅ Excellent! You're building exam confidence step by step. 🌱`
      : `🌱 Keep going. Every question makes you stronger for the exam. ✨`;

    const questionsCompleted = state.questions_in_set || 1;
    const maxQuestions = state.max_questions || 5;

    if (questionsCompleted >= maxQuestions) {
      session.session_state.practice_active = false;
      await saveSession(session);
      await updateUser(user.id, { current_menu: 'practice_continue', current_question_id: null });

      return `${feedback}\n\n🎯 Great exam prep session! You're getting sharper.\n\n${getExamPrepContinueMenu()}`;
    } else {
      const nextQuestion = await getNextExamPracticeQuestion(user, session);
      if (!nextQuestion) {
        session.session_state.practice_active = false;
        await saveSession(session);
        await updateUser(user.id, { current_menu: 'practice_continue', current_question_id: null });

        return `${feedback}\n\n${getExamPrepContinueMenu()}`;
      }

      await questionService.serveQuestionToUser(user.id, nextQuestion.id);
      session.session_state.questions_in_set = questionsCompleted + 1;
      await saveSession(session);

      return `${feedback}\n\n${formatQuestion(nextQuestion)}`;
    }
  },

  // FIXED: Exam practice continue with correct context
  async handleExamPracticeContinue(user, action) {
    const session = await getOrCreateExamPrepSession(user.id);

    if (action === 'continue') {
      return await this.startExamPractice(user, session);
    }

    if (action === 'switch_topic') {
      const newTopic = session.current_topic === 'calculus' ? 'trigonometry' : 'calculus';
      session.current_topic = newTopic;
      await saveSession(session);
      return await this.startPersonalizedLesson(user, session);
    }

    if (action === 'back_to_homework') {
      // This should be "back to exam prep"
      return await this.handleExamPrepPlanAction(user, 'main_menu');
    }

    if (action === 'take_break') {
      await endExamPrepSession(session.id);
      await clearExamPrepState(user.id);
      return `Good call. Rest up and come back when you're ready to prep! 📅\n\nType "menu" for options.`;
    }

    return `Pick 1, 2, 3, or 4 from the menu above. ✨`;
  },

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
          panic_session_id: null
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
    const newTopic = currentTopic === 'calculus' ? 'trigonometry' : 'calculus';

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
    const topicDisplay = topic === 'calculus' ? 'Calculus' : 'Trigonometry';

    let planHeader = `📅 EXAM PREP PLAN\n\n`;

    if (options.topicSwitched) {
      planHeader += `✅ Switched to ${topicDisplay}!\n\n`;
    }

    planHeader += `📚 Focus: ${topicDisplay}\n`;

    if (session.exam_date) {
      const examDate = new Date(session.exam_date);
      const confirmation = formatExamDate(examDate);
      planHeader += `⏰ Exam: ${confirmation}\n`;
    }

    planHeader += `\nWhat would you like to do?\n\n`;
    planHeader += `1️⃣ Begin review\n`;
    planHeader += `2️⃣ Switch topics\n`;
    planHeader += `3️⃣ Main menu`;

    return planHeader;
  },
  

    // Start lesson with proper context
  async startExamLesson(user, session) {
    const topic = session.current_topic || 'calculus';
    const lessonContent = CONSTANTS.LESSONS[topic.toUpperCase() + '_INTRO'];
    
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
    
    switch (choice) {
      case 1: // Try practice questions
        return await this.startExamPractice(user, topic);
        
      case 2: // See another example
        const example = CONSTANTS.EXAMPLES[topic.toUpperCase() + '_EXTRA'];
        const menuOptions = MenuRenderer.renderLessonMenu('exam');
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
  }
};

// Helper function for date formatting
function formatExamDate(date) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

// ENHANCED: Enhanced date parsing function
function parseEnhancedDateString(dateStr) {
  try {
    const normalized = dateStr.toLowerCase().replace(/\s+/g, ' ').trim();
    const now = new Date();

    // Handle relative dates
    if (normalized.includes('tomorrow')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Extract time if provided
      const timeMatch = dateStr.match(/(\d{1,2})\s*([ap]m)/i);
      if (timeMatch) {
        const hour = parseInt(timeMatch[1]);
        const isPM = timeMatch[2].toLowerCase() === 'pm';
        const hour24 = isPM && hour !== 12 ? hour + 12 : !isPM && hour === 12 ? 0 : hour;
        tomorrow.setHours(hour24, 0, 0, 0);
      }
      return tomorrow;
    }

    if (normalized.includes('today')) {
      const today = new Date();
      const timeMatch = dateStr.match(/(\d{1,2})\s*([ap]m)/i);
      if (timeMatch) {
        const hour = parseInt(timeMatch[1]);
        const isPM = timeMatch[2].toLowerCase() === 'pm';
        const hour24 = isPM && hour !== 12 ? hour + 12 : !isPM && hour === 12 ? 0 : hour;
        today.setHours(hour24, 0, 0, 0);
      }
      return today;
    }

    // Handle "next Monday", "next week" etc.
    if (normalized.includes('next monday')) {
      const nextMonday = new Date();
      const daysToAdd = (1 + 7 - nextMonday.getDay()) % 7 || 7;
      nextMonday.setDate(nextMonday.getDate() + daysToAdd);
      return nextMonday;
    }

    // Handle "in X days"
    const inDaysMatch = normalized.match(/in\s+(\d+)\s+days?/);
    if (inDaysMatch) {
      const days = parseInt(inDaysMatch[1]);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      return futureDate;
    }

    // FIXED: Handle formats like "22 Aug 2pm", "Aug 22", "22 August 2025"
    const patterns = [
      /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*(\d{1,2})?(?:\s*([ap]m))?/i,
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:\s*(\d{1,2})?(?:\s*([ap]m))?)?/i,
      /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s*(\d{1,2})?(?:\s*([ap]m))?)?/
    ];

    for (const pattern of patterns) {
      const match = dateStr.match(pattern);
      if (match) {
        let day, month, year, time, period;

        if (pattern.source.includes('jan|feb')) {
          // Month name patterns
          if (match[1].length <= 2) {
            // Day first: "22 Aug"
            day = parseInt(match[1]);
            month = getMonthNumber(match[2]);
            time = match[3] ? parseInt(match[3]) : null;
            period = match[4];
          } else {
            // Month first: "Aug 22"
            month = getMonthNumber(match[1]);
            day = parseInt(match[2]);
            time = match[3] ? parseInt(match[3]) : null;
            period = match[4];
          }
          year = now.getFullYear();
        } else {
          // Numeric date: "22/8" or "8/22"
          day = parseInt(match[1]);
          month = parseInt(match[2]) - 1; // JS months are 0-indexed
          year = match[3] ? parseInt(match[3]) : now.getFullYear();
          time = match[4] ? parseInt(match[4]) : null;
          period = match[5];
        }

        const parsedDate = new Date(year, month, day);

        // Set time if provided
        if (time && period) {
          const isPM = period.toLowerCase() === 'pm';
          const hour24 = isPM && time !== 12 ? time + 12 : !isPM && time === 12 ? 0 : time;
          parsedDate.setHours(hour24, 0, 0, 0);
        }

        // Ensure date is in the future
        if (parsedDate > now) {
          return parsedDate;
        } else if (parsedDate.getTime() !== now.getTime()) {
          // Try next year if date has passed
          parsedDate.setFullYear(parsedDate.getFullYear() + 1);
          if (parsedDate > now) return parsedDate;
        }
      }
    }

    // Fallback to standard Date parsing
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime()) && parsed > now) {
      return parsed;
    }

    return null;
  } catch (error) {
    console.error('Date parsing error:', error);
    return null;
  }
}

// Helper function to convert month names to numbers
function getMonthNumber(monthStr) {
  const months = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11
  };
  return months[monthStr.toLowerCase()] || 0;
}

// ENHANCED: Personalized lesson content generators
function getPersonalizedCalculusLesson(analysis) {
  const concepts = analysis.concepts || [];
  const hasDerivatives = concepts.some(
    (c) => c.includes('derivative') || c.includes('differentiat')
  );
  const hasLimits = concepts.some((c) => c.includes('limit'));

  let lesson = `📘 **CALCULUS METHOD GUIDE** - Tailored for You\n\n`;

  if (hasDerivatives) {
    lesson += `🎯 **DERIVATIVES FOCUS** (based on your concerns):\n`;
    lesson += `• **What they mean:** Rate of change (like speed from distance)\n`;
    lesson += `• **Pattern:** f'(x) = lim_{h→0} (f(x+h) − f(x)) / h\n`;
    lesson += `• **Your key insight:** It's about how fast something changes!\n\n`;
  } else if (hasLimits) {
    lesson += `🎯 **LIMITS FOCUS** (based on your concerns):\n`;
    lesson += `• **What they mean:** What value function approaches\n`;
    lesson += `• **Key insight:** We're finding the "trend" as we get closer\n\n`;
  }

  lesson += `**Step-by-step method:**\n`;
  lesson += `1) Expand the function with (x+h)\n`;
  lesson += `2) Simplify by subtracting original function\n`;
  lesson += `3) Factor out h from the result\n`;
  lesson += `4) Take the limit as h approaches 0\n\n`;

  lesson += `**Worked example:** f(x) = x² → f'(x) = 2x\n\n`;
  lesson += `1️⃣ Try practice questions\n`;
  lesson += `2️⃣ See another example\n`;
  lesson += `3️⃣ Back to exam prep`;

  return lesson;
}

function getPersonalizedTrigLesson(analysis) {
  const concepts = analysis.concepts || [];
  const hasIdentities = concepts.some((c) => c.includes('identity') || c.includes('identities'));
  const hasRatios = concepts.some(
    (c) => c.includes('sin') || c.includes('cos') || c.includes('tan')
  );

  let lesson = `📗 **TRIGONOMETRY GUIDE** - Tailored for You\n\n`;

  if (hasIdentities) {
    lesson += `🎯 **TRIG IDENTITIES FOCUS** (based on your concerns):\n`;
    lesson += `• **Master identity:** sin²(x) + cos²(x) = 1\n`;
    lesson += `• **Your key insight:** Everything connects back to this!\n\n`;
  } else if (hasRatios) {
    lesson += `🎯 **TRIG RATIOS FOCUS** (based on your concerns):\n`;
    lesson += `• **Remember SOHCAHTOA:** Sin=O/H, Cos=A/H, Tan=O/A\n`;
    lesson += `• **Your key insight:** It's all about triangle relationships!\n\n`;
  }

  lesson += `**Problem-solving method:**\n`;
  lesson += `1) Identify what trig functions you have\n`;
  lesson += `2) Use the fundamental identity: sin² + cos² = 1\n`;
  lesson += `3) Convert everything to sin and cos if needed\n`;
  lesson += `4) Simplify step by step\n\n`;

  lesson += `**Example:** (1 - cos²x)/sin x = sin²x/sin x = sin x\n\n`;
  lesson += `1️⃣ Try practice questions\n`;
  lesson += `2️⃣ See another example\n`;
  lesson += `3️⃣ Back to exam prep`;

  return lesson;
}

// FIXED: Context-appropriate continue menu for exam prep
function getExamPrepContinueMenu() {
  return (
    `What's next?\n\n` +
    `1️⃣ Continue practicing\n` +
    `2️⃣ Switch topic\n` +
    `3️⃣ Back to exam prep\n` +
    `4️⃣ Take a break\n\n` +
    `Pick a number! ✨`
  );
}

function generateProblemDetailsPrompt() {
  return (
    `Tell me what specific topics or concepts you're worried about for your exam.\n\n` +
    `**Examples:**\n` +
    `• "Derivatives confuse me"\n` +
    `• "Word problems are hard"\n` +
    `• "I struggle with factoring"\n` +
    `• "Trigonometry makes no sense"\n\n` +
    `**Or be general:** "math is hard" or "everything confuses me"\n\n` +
    `The more specific, the better I can help! 🧠`
  );
}

// Improved plan generation with better menu options
async function generateShortPlan(session) {
  session.current_topic = 'calculus';
  session.session_state = { step: 'plan_action' };
  await saveSession(session);

  let planText = `📅 EXAM PREP PLAN\n\n`;

  if (session.exam_hours_away && session.exam_hours_away <= 24) {
    planText += `⚡ CRUNCH TIME MODE:\n`;
    planText += `• Quick review of key concepts\n`;
    planText += `• High-yield practice questions\n`;
    planText += `• Confidence building exercises\n\n`;
  } else {
    planText += `🎯 FOCUSED PREP:\n`;
    planText += `• Targeted topic review\n`;
    planText += `• Practice questions\n`;
    planText += `• Build exam confidence\n\n`;
  }

  planText += `Ready to start?\n` + `1️⃣ Begin\n` + `2️⃣ Switch topics\n` + `3️⃣ Main Menu`;

  return planText;
}

async function generateLongPlan(session) {
  session.current_topic = 'calculus';
  session.session_state = { step: 'plan_action' };
  await saveSession(session);

  const timeStr = session.preferred_daily_time || '19:00';
  const examDate = session.exam_date
    ? new Date(session.exam_date).toLocaleDateString()
    : 'your exam';

  return (
    `📅 DAILY STUDY PLAN (Until ${examDate})\n\n` +
    `Daily at ${timeStr}:\n` +
    `• 15 min: Topic review\n` +
    `• 10 min: Practice questions\n` +
    `• 5 min: Confidence building\n\n` +
    `Today's focus: Core concepts\n\n` +
    `1️⃣ Begin\n` +
    `2️⃣ Switch topics\n` +
    `3️⃣ Main Menu`
  );
}

function generateExtraExample(topic) {
  if (topic === 'calculus') {
    return (
      `Extra derivative example:\n` +
      `f(x) = 2x³ + x\n` +
      `f'(x) = 6x² + 1\n` +
      `(Power rule: bring down exponent, reduce by 1)`
    );
  } else {
    return (
      `Extra trig example:\n` +
      `sin²(x) + cos²(x) = 1\n` +
      `So: sin²(x) = 1 - cos²(x)\n` +
      `Use this to simplify complex expressions`
    );
  }
}

// Helper functions (mostly unchanged)
async function getOrCreateExamPrepSession(userId) {
  return await executeQuery(async (supabase) => {
    const { data: existing } = await supabase
      .from('panic_sessions')
      .select('*')
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) return existing;

    const { data: created, error } = await supabase
      .from('panic_sessions')
      .insert({
        user_id: userId,
        panic_level: 2, // Default moderate urgency
        subject: 'math',
        start_topic: 'calculus',
        session_state: { step: 'ask_problem_details' }
      })
      .select('*')
      .single();

    if (error) throw error;
    return created;
  });
}

async function saveSession(session) {
  return await executeQuery(async (supabase) => {
    const { error } = await supabase
      .from('panic_sessions')
      .update({
        panic_level: 2, // Exam prep default
        subject: 'math',
        start_topic: session.current_topic || 'calculus',
        session_state: session.session_state || {},
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id);
    if (error) throw error;
  });
}

async function markUserInExamPrepFlow(userId, sessionId, menuState) {
  await updateUser(userId, {
    current_menu: menuState,
    panic_session_id: sessionId,
    last_active_at: new Date().toISOString()
  });
}

async function clearExamPrepState(userId) {
  await updateUser(userId, {
    current_menu: 'welcome',
    panic_session_id: null,
    current_question_id: null,
    last_active_at: new Date().toISOString()
  });
}

async function endExamPrepSession(sessionId) {
  return await executeQuery(async (supabase) => {
    const { error } = await supabase
      .from('panic_sessions')
      .update({
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);
    if (error) throw error;
  });
}

async function fetchQuestionAndCheck(questionId, answerLetter) {
  return await executeQuery(async (supabase) => {
    const { data: question, error } = await supabase
      .from('mcqs')
      .select('id, correct_choice')
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

async function getNextExamPracticeQuestion(user, session) {
  const topic = session.current_topic || 'calculus';

  return await questionService.getQuestionByTopic(user, topic, {
    subject: 'math',
    difficulty: 'easy',
    excludeRecent: true
  });
}
