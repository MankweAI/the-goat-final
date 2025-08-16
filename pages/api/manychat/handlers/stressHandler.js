/**
 * Stress Support Handler (Formerly Panic)
 * Date: 2025-08-16 16:53:38 UTC
 * Flow: Grade → Stress Level → Subject → Exam Date → Study Plan
 */

import { executeQuery } from '../config/database.js';
import { updateUser } from '../services/userService.js';
import { questionService } from '../services/questionService.js';
import { formatQuestion } from '../utils/questionFormatter.js';
import { CONSTANTS, MESSAGES } from '../config/constants.js';

export const stressHandler = {
  // Entry point
  async startStressSupport(user) {
    const session = await getOrCreateActiveStressSession(user.id);

    // Check if we have grade
    if (!user.grade) {
      session.session_state = { step: 'ask_grade' };
      await saveSession(session);
      await markUserInStressFlow(user.id, session.id);

      return MESSAGES.WELCOME.GRADE_PROMPT;
    }

    // Go straight to stress level
    session.session_state = { step: 'ask_stress_level' };
    await saveSession(session);
    await markUserInStressFlow(user.id, session.id);

    return generateStressLevelPrompt();
  },

  // Handle menu choices in stress flow
  async handleStressMenu(user, choice) {
    const session = await getOrCreateActiveStressSession(user.id);
    const state = session.session_state || {};
    const step = state.step || 'ask_stress_level';

    console.log(`🔍 Stress flow: step=${step}, choice=${choice}`);

    if (step === 'ask_grade') {
      if (['10', '11', 'varsity'].includes(String(choice))) {
        await updateUser(user.id, { grade: String(choice) });
        session.session_state = { step: 'ask_stress_level' };
        await saveSession(session);
        return generateStressLevelPrompt();
      }
      return `Please choose 10, 11, or varsity for your grade. 🎓`;
    }

    if (step === 'ask_stress_level') {
      if (choice >= 1 && choice <= 4) {
        session.stress_level = choice;
        session.session_state = { step: 'ask_subject' };
        await saveSession(session);

        // Add validation based on stress level
        const validation =
          choice <= 2 ? MESSAGES.STRESS.VALIDATION_HIGH : MESSAGES.STRESS.VALIDATION_LOW;

        return `${validation}\n\n${MESSAGES.STRESS.SUBJECT_PROMPT}`;
      }
      return `Please pick a number 1–4 for your stress level. 🌱`;
    }

    if (step === 'ask_subject') {
      // All lead to math for MVP, but acknowledge their choice
      const subjectNames = { 1: 'Mathematics', 2: 'Physics', 3: 'Chemistry', 4: 'Life Sciences' };
      const chosenName = subjectNames[choice] || 'Mathematics';

      if (choice !== 1) {
        session.requested_subject = chosenName;
      }

      session.focus_subject = 'math';
      session.session_state = { step: 'ask_exam_date' };
      await saveSession(session);

      const response =
        choice !== 1
          ? `I hear you about ${chosenName}. Let's start with Maths foundations—they help with all subjects.\n\n`
          : `Great choice. Let's focus on Maths.\n\n`;

      return response + MESSAGES.STRESS.EXAM_DATE_PROMPT;
    }

    if (step === 'ask_exam_date') {
      return `Please tell me your exam date (e.g., "22 Aug 7pm") or say "skip". ⏳`;
    }

    if (step === 'plan_decision') {
      if (choice === 1) {
        // Yes to plan
        if (session.exam_hours_away > 3) {
          session.session_state = { step: 'ask_preferred_time' };
          await saveSession(session);
          return MESSAGES.STRESS.TIME_PROMPT;
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

    if (step === 'ask_preferred_time') {
      // They should provide time via text, not number
      return `Please tell me your preferred daily time (e.g., "7pm"). ⏰`;
    }

    if (step === 'plan_action') {
      if (choice === 1) {
        // Start now
        return await this.startLesson(user, session);
      }
      if (choice === 2) {
        // Switch topic
        const newTopic = session.current_topic === 'calculus' ? 'trigonometry' : 'calculus';
        session.current_topic = newTopic;
        await saveSession(session);
        return await this.startLesson(user, session);
      }
      if (choice === 3) {
        // Cancel
        await endStressSession(session.id);
        await clearStressState(user.id);
        return `No stress. If you need support again, just say "stressed". 🌱`;
      }
      return `Please choose 1, 2, or 3 from the plan options. ✨`;
    }

    return `I didn't catch that. Let's try again. 🌱`;
  },

  // Handle text inputs (exam date, preferred time)
  async handleStressText(user, text) {
    const session = await getOrCreateActiveStressSession(user.id);
    const state = session.session_state || {};

    if (state.step === 'ask_exam_date') {
      const lowerText = text.toLowerCase().trim();

      if (lowerText === 'skip') {
        // No exam date - offer general practice
        session.exam_date = null;
        session.exam_hours_away = null;
        session.session_state = { step: 'show_plan_short' };
        await saveSession(session);
        return await generateShortPlan(session);
      }

      // Try to parse date
      const examDate = parseDateString(text);
      if (examDate) {
        session.exam_date = examDate.toISOString();
        session.exam_hours_away = Math.max(0, (examDate - new Date()) / (1000 * 60 * 60));

        // Decide on plan type
        session.session_state = { step: 'plan_decision' };
        await saveSession(session);

        if (session.exam_hours_away > 3) {
          return MESSAGES.STRESS.PLAN_OFFER_LONG;
        } else {
          return MESSAGES.STRESS.PLAN_OFFER_SHORT;
        }
      } else {
        return `I didn't catch the date. Try "22 Aug 7pm" or say "skip". ⏳`;
      }
    }

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

        return await generateLongPlan(session);
      } else {
        return `Try a time like "7pm" or "19:00". ⏰`;
      }
    }

    return `I didn't catch that. Type "menu" to start over. 🌱`;
  },

  // Start lesson with practice
  async startLesson(user, session) {
    const topic = session.current_topic || 'calculus';

    // Show micro-lesson first
    await updateUser(user.id, { current_menu: 'lesson' });

    const lessonContent =
      topic === 'calculus' ? MESSAGES.LESSONS.CALCULUS_INTRO : MESSAGES.LESSONS.TRIGONOMETRY_INTRO;

    return lessonContent;
  },

  // Handle lesson actions
  async handleLessonAction(user, action) {
    const session = await getOrCreateActiveStressSession(user.id);

    if (action === 'start_practice') {
      return await this.startGentlePractice(user, session);
    }

    if (action === 'another_example') {
      const topic = session.current_topic || 'calculus';
      const extraExample = generateExtraExample(topic);
      return `${extraExample}\n\n${MESSAGES.LESSONS.CALCULUS_INTRO.split('1️⃣')[1]}`;
    }

    if (action === 'cancel') {
      await endStressSession(session.id);
      await clearStressState(user.id);
      return `Take your time. Say "stressed" when you're ready. 🌱`;
    }

    return `Pick 1, 2, or 3 from the lesson options. ✨`;
  },

  // Start gentle practice (3 questions internally)
  async startGentlePractice(user, session) {
    const topic = session.current_topic || 'calculus';

    // Get easy question
    const question = await questionService.getQuestionByTopic(user, topic, {
      subject: 'math',
      difficulty: 'easy',
      excludeRecent: true
    });

    if (!question) {
      return `No practice questions available right now. Let's try again later. 🌱`;
    }

    // Set up practice session
    await questionService.serveQuestionToUser(user.id, question.id);
    await updateUser(user.id, { current_menu: 'practice_active' });

    // Initialize practice tracking in session
    session.session_state = {
      ...session.session_state,
      practice_active: true,
      questions_in_set: 1,
      max_questions: 3,
      current_topic: topic
    };
    await saveSession(session);

    return `${MESSAGES.PRACTICE.START_PROMPT}\n\n${formatQuestion(question)}`;
  },

  // Handle practice answers
  async handlePracticeAnswer(user, answerLetter) {
    const session = await getOrCreateActiveStressSession(user.id);
    const state = session.session_state || {};

    if (!state.practice_active || !user.current_question_id) {
      return `Type "practice" to start practicing! 🧮`;
    }

    // Get and check answer
    const { question, correct } = await fetchQuestionAndCheck(
      user.current_question_id,
      answerLetter
    );

    // Record response
    await questionService.recordUserResponse(user.id, question.id, answerLetter, correct, null);

    // Generate feedback
    const feedback = correct
      ? `${MESSAGES.FEEDBACK.CORRECT_SIMPLE} You're building confidence step by step. 🌱`
      : `${MESSAGES.FEEDBACK.INCORRECT_SIMPLE} Let's keep going gently. ✨`;

    // Update practice progress
    const questionsCompleted = state.questions_in_set || 1;
    const maxQuestions = state.max_questions || 3;

    if (questionsCompleted >= maxQuestions) {
      // Practice set complete
      session.session_state.practice_active = false;
      await saveSession(session);
      await updateUser(user.id, { current_menu: 'practice_continue', current_question_id: null });

      return `${feedback}\n\n✅ Nice work. You completed a gentle practice set.\n\n${MESSAGES.PRACTICE.CONTINUE_MENU}`;
    } else {
      // Get next question
      const nextQuestion = await getNextPracticeQuestion(user, session);
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

  // Handle practice continue menu
  async handlePracticeContinue(user, action) {
    const session = await getOrCreateActiveStressSession(user.id);

    if (action === 'continue') {
      return await this.startGentlePractice(user, session);
    }

    if (action === 'switch_topic') {
      const newTopic = session.current_topic === 'calculus' ? 'trigonometry' : 'calculus';
      session.current_topic = newTopic;
      await saveSession(session);
      return await this.startLesson(user, session);
    }

    if (action === 'short_break') {
      await endStressSession(session.id);
      await clearStressState(user.id);
      return `Take your time. Breathe. You're doing well. 🌱\n\nSay "practice" when ready to continue.`;
    }

    if (action === 'remind_tonight') {
      await createTonightReminder(user.id, session);
      await endStressSession(session.id);
      await clearStressState(user.id);
      return `I'll check in with you tonight. Rest well. 🌙`;
    }

    return `Pick 1, 2, 3, or 4 from the menu above. ✨`;
  }
};

// Helper functions
async function getOrCreateActiveStressSession(userId) {
  return await executeQuery(async (supabase) => {
    const { data: existing } = await supabase
      .from('panic_sessions') // Keep table name for backward compatibility
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
        panic_level: 3, // Default stress level
        subject: 'math',
        start_topic: 'calculus',
        session_state: { step: 'ask_stress_level' }
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
        panic_level: session.stress_level || session.panic_level || 3,
        subject: session.focus_subject || 'math',
        start_topic: session.current_topic || 'calculus',
        session_state: session.session_state || {},
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id);
    if (error) throw error;
  });
}

async function markUserInStressFlow(userId, sessionId) {
  await updateUser(userId, {
    current_menu: 'stress_level',
    panic_session_id: sessionId, // Keep field name for compatibility
    last_active_at: new Date().toISOString()
  });
}

async function clearStressState(userId) {
  await updateUser(userId, {
    current_menu: 'welcome',
    panic_session_id: null,
    current_question_id: null,
    last_active_at: new Date().toISOString()
  });
}

async function endStressSession(sessionId) {
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

function generateStressLevelPrompt() {
  return MESSAGES.STRESS.LEVEL_PROMPT;
}

async function generateShortPlan(session) {
  session.current_topic = 'calculus';
  session.session_state = { step: 'plan_action' };
  await saveSession(session);

  return (
    `🧭 GENTLE PLAN (Short Session)\n\n` +
    `Now (~20 min): Quick review + gentle practice\n` +
    `Focus: One concept, steady pace\n` +
    `Goal: Build confidence step by step\n\n` +
    `Ready?\n` +
    `1️⃣ Start now\n` +
    `2️⃣ Switch to trigonometry\n` +
    `3️⃣ Take a break`
  );
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
    `🧭 STUDY PLAN (Until ${examDate})\n\n` +
    `Daily at ${timeStr}:\n` +
    `• Short lesson (~10 min)\n` +
    `• Gentle practice (~10 min)\n` +
    `• Build confidence daily\n\n` +
    `Today's focus: Calculus foundations\n\n` +
    `1️⃣ Start first lesson\n` +
    `2️⃣ Switch to trigonometry\n` +
    `3️⃣ Adjust plan later`
  );
}

function generateExtraExample(topic) {
  if (topic === 'calculus') {
    return (
      `Extra example:\n` +
      `f(x) = x³\n` +
      `f(x+h) - f(x) = (x+h)³ - x³ = 3x²h + 3xh² + h³\n` +
      `Divide by h: 3x² + 3xh + h²\n` +
      `Limit h→0: 3x²`
    );
  } else {
    return (
      `Extra example:\n` +
      `Simplify: (cos²x - 1)/cos x\n` +
      `= -(1 - cos²x)/cos x = -(sin²x)/cos x\n` +
      `= -(sin x)(sin x/cos x) = -(sin x)(tan x)`
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

async function getNextPracticeQuestion(user, session) {
  const topic = session.current_topic || 'calculus';

  return await questionService.getQuestionByTopic(user, topic, {
    subject: 'math',
    difficulty: 'easy',
    excludeRecent: true
  });
}

async function createTonightReminder(userId, session) {
  const tonight = new Date();
  tonight.setHours(19, 0, 0, 0); // 7 PM
  if (tonight <= new Date()) {
    tonight.setDate(tonight.getDate() + 1); // Tomorrow if already past 7 PM
  }

  try {
    await executeQuery(async (supabase) => {
      await supabase.from('reminders').insert({
        user_id: userId,
        type: 'stress_followup',
        scheduled_for: tonight.toISOString(),
        metadata: { session_id: session.id, source: 'stress_support' }
      });
    });
  } catch (error) {
    console.warn('Reminder creation failed (non-fatal):', error.message);
  }
}

function parseDateString(dateStr) {
  // Simple date parsing - can be enhanced
  try {
    const normalized = dateStr.toLowerCase().replace(/\s+/g, ' ').trim();

    // Handle "tomorrow" and "today"
    if (normalized.includes('tomorrow')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }

    if (normalized.includes('today')) {
      return new Date();
    }

    // Try to parse as date
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime()) && parsed > new Date()) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}
