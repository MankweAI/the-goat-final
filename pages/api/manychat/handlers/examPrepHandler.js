/**
 * Exam Prep Handler - FIXED Plan Action Handling + Improved Menu
 * Date: 2025-08-17 12:37:33 UTC
 * CRITICAL FIX: Added handleExamPrepPlanAction method and improved menu text
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

    // Go straight to subject selection (skip stress level)
    session.session_state = { step: 'ask_subject' };
    await saveSession(session);
    await markUserInExamPrepFlow(user.id, session.id, 'exam_prep_subject');

    return `${MESSAGES.EXAM_PREP.VALIDATION_RESPONSE}\n\n${MESSAGES.EXAM_PREP.SUBJECT_PROMPT}`;
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

      // Move to problem articulation step (if complex) or exam date
      session.session_state = { step: 'ask_problem_details' };
      await saveSession(session);
      await updateUser(user.id, { current_menu: 'exam_prep_problems' });

      const response =
        choice !== 1
          ? `I hear you about ${chosenName}. Let's start with Maths foundations—they help with all subjects.\n\n`
          : `Great choice. Let's focus on Maths for your exam.\n\n`;

      return response + generateProblemDetailsPrompt();
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

  // CRITICAL FIX: NEW METHOD - Handle exam prep plan actions
  async handleExamPrepPlanAction(user, action) {
    const session = await getOrCreateExamPrepSession(user.id);

    console.log(`📅 Exam prep plan action: ${action}`);

    if (action === 'begin_review') {
      return await this.startLesson(user, session);
    }

    if (action === 'switch_topic') {
      const newTopic = session.current_topic === 'calculus' ? 'trigonometry' : 'calculus';
      session.current_topic = newTopic;
      await saveSession(session);
      return await this.startLesson(user, session);
    }

    if (action === 'main_menu') {
      await endExamPrepSession(session.id);
      await clearExamPrepState(user.id);
      return `All good! When you're ready to prep again, just say "exam". 📅\n\nType "menu" for main options! ✨`;
    }

    return `Please choose 1, 2, or 3 from the plan options. ✨`;
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

        session.session_state = { step: 'ask_subject' };
        await saveSession(session);
        await markUserInExamPrepFlow(user.id, session.id, 'exam_prep_subject');

        return `${MESSAGES.EXAM_PREP.VALIDATION_RESPONSE}\n\n${MESSAGES.EXAM_PREP.SUBJECT_PROMPT}`;
      } else {
        return `Please choose 10, 11, or varsity for your grade. 🎓`;
      }
    }

    // Handle problem details (optional enhanced analysis)
    if (state.step === 'ask_problem_details') {
      return await this.processProblemDescription(user, session, text);
    }

    // Handle exam date input
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

      const examDate = parseDateString(text);
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
        return `I didn't catch the date. Try "22 Aug 7pm" or say "skip". ⏳`;
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

  // Process problem description (optional)
  async processProblemDescription(user, session, problemText) {
    try {
      // Simplified - move directly to exam date
      session.session_state = { step: 'ask_exam_date' };
      await saveSession(session);
      await updateUser(user.id, { current_menu: 'exam_prep_exam_date' });

      return `Got it! Let's focus on what you need for your exam.\n\n${MESSAGES.EXAM_PREP.EXAM_DATE_PROMPT}`;
    } catch (error) {
      console.error('❌ Problem description processing failed:', error);

      session.session_state = { step: 'ask_exam_date' };
      await saveSession(session);
      await updateUser(user.id, { current_menu: 'exam_prep_exam_date' });

      return `Let's build a focused study plan for your exam.\n\n${MESSAGES.EXAM_PREP.EXAM_DATE_PROMPT}`;
    }
  },

  // Rest of methods (unchanged but included for completeness)
  async startLesson(user, session) {
    const topic = session.current_topic || 'calculus';

    await updateUser(user.id, { current_menu: 'lesson' });

    const lessonContent =
      topic === 'calculus' ? MESSAGES.LESSONS.CALCULUS_INTRO : MESSAGES.LESSONS.TRIGONOMETRY_INTRO;

    return lessonContent;
  },

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

    if (action === 'cancel') {
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

      return `${feedback}\n\n🎯 Great exam prep session! You're getting sharper.\n\n${MESSAGES.PRACTICE.CONTINUE_MENU}`;
    } else {
      const nextQuestion = await getNextExamPracticeQuestion(user, session);
      if (!nextQuestion) {
        session.session_state.practice_active = false;
        await saveSession(session);
        await updateUser(user.id, { current_menu: 'practice_continue', current_question_id: null });

        return `${feedback}\n\n${MESSAGES.PRACTICE.CONTINUE_MENU}`;
      }

      await questionService.serveQuestionToUser(user.id, nextQuestion.id);
      session.session_state.questions_in_set = questionsCompleted + 1;
      await saveSession(session);

      return `${feedback}\n\n${formatQuestion(nextQuestion)}`;
    }
  },

  async handleExamPracticeContinue(user, action) {
    const session = await getOrCreateExamPrepSession(user.id);

    if (action === 'continue') {
      return await this.startExamPractice(user, session);
    }

    if (action === 'switch_topic') {
      const newTopic = session.current_topic === 'calculus' ? 'trigonometry' : 'calculus';
      session.current_topic = newTopic;
      await saveSession(session);
      return await this.startLesson(user, session);
    }

    if (action === 'short_break') {
      await endExamPrepSession(session.id);
      await clearExamPrepState(user.id);
      return `Good call. Rest up and come back when you're ready to prep! 📅\n\nType "menu" for options.`;
    }

    if (action === 'remind_tonight') {
      await createTonightReminder(user.id, session);
      await endExamPrepSession(session.id);
      await clearExamPrepState(user.id);
      return `I'll remind you to study tonight. Rest well before your exam! 🌙`;
    }

    return `Pick 1, 2, 3, or 4 from the menu above. ✨`;
  }
};

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
        session_state: { step: 'ask_subject' }
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
        subject: session.focus_subject || 'math',
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

function generateProblemDetailsPrompt() {
  return (
    `Tell me what specific topics or concepts you're worried about for your exam.\n\n` +
    `Examples:\n` +
    `• "Derivatives confuse me"\n` +
    `• "Word problems are hard"\n` +
    `• "I struggle with factoring"\n\n` +
    `Or just say "general" if you want overall review. 🧠`
  );
}

// UPDATED: Improved plan generation with better menu options
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

  // IMPROVED: Better menu options per user feedback
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

async function createTonightReminder(userId, session) {
  const tonight = new Date();
  tonight.setHours(19, 0, 0, 0);
  if (tonight <= new Date()) {
    tonight.setDate(tonight.getDate() + 1);
  }

  try {
    await executeQuery(async (supabase) => {
      await supabase.from('reminders').insert({
        user_id: userId,
        type: 'exam_prep_followup',
        scheduled_for: tonight.toISOString(),
        metadata: { session_id: session.id, source: 'exam_prep' }
      });
    });
  } catch (error) {
    console.warn('Reminder creation failed (non-fatal):', error.message);
  }
}

function parseDateString(dateStr) {
  try {
    const normalized = dateStr.toLowerCase().replace(/\s+/g, ' ').trim();

    if (normalized.includes('tomorrow')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }

    if (normalized.includes('today')) {
      return new Date();
    }

    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime()) && parsed > new Date()) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}
