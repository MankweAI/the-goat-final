/**
 * Panic Button Handler (Maths-only MVP)
 * Flow: triage (level -> topic) -> plan -> micro-module -> 3Q burst -> momentum menu
 * Data: persists to panic_sessions; uses users.current_menu = 'panic'
 */

import { executeQuery } from '../config/database.js';
import { updateUser } from '../services/userService.js';
import { questionService } from '../services/questionService.js';
import { formatQuestion } from '../utils/questionFormatter.js';

const TOPICS = {
  calculus: 'calculus',
  trigonometry: 'trigonometry',
  unknown: 'unknown'
};

export const panicHandler = {
  // Entry point
  async startPanic(user) {
    const session = await getOrCreateActivePanicSession(user.id);

    // Reset to the first step on a fresh start
    session.session_state = { step: 'ask_level' };
    await saveSession(session);
    await markUserInPanic(user.id, session.id);

    return (
      `🚨 PANIC MODE (Maths only)\n` +
      `Sharp, I’ve got you. Let’s calm the nerves and score quick wins.\n\n` +
      `How high is your panic right now? (1-5)\n\n` +
      `1) Mild\n2) Manageable\n3) Elevated\n4) High\n5) Severe`
    );
  },

  // Handle numeric menu choices while in panic
  async handleMenu(user, choiceNumber) {
    const session = await getOrCreateActivePanicSession(user.id);

    const state = session.session_state || {};
    const step = state.step || 'ask_level';

    if (step === 'ask_level') {
      const lvl = parseInt(choiceNumber, 10);
      if (isNaN(lvl) || lvl < 1 || lvl > 5) {
        return `Please choose a number 1–5 for panic level.`;
      }
      session.panic_level = lvl;
      session.session_state = { step: 'ask_topic' };
      await saveSession(session);

      return (
        `Got it. Panic level: ${lvl}.\n\nChoose a Maths topic to stabilise on:\n` +
        `1) Calculus (first principles)\n` +
        `2) Trigonometry (identity)\n` +
        `3) Not sure`
      );
    }

    if (step === 'ask_topic') {
      const map = { 1: TOPICS.calculus, 2: TOPICS.trigonometry, 3: TOPICS.unknown };
      const topic = map[choiceNumber];
      if (!topic) {
        return `Pick 1, 2, or 3 to choose a topic.`;
      }

      session.start_topic = topic;
      session.session_state = { step: 'plan' };
      await saveSession(session);

      return renderPlan(topic);
    }

    if (step === 'plan') {
      // Expect: 1) Start now 2) Switch topic 3) Cancel
      if (choiceNumber === 1) {
        session.session_state = { step: 'micro_module' };
        await saveSession(session);
        return renderMicroModuleIntro(session.start_topic || TOPICS.calculus);
      }
      if (choiceNumber === 2) {
        // Toggle topic
        const toggled = toggleTopic(session.start_topic || TOPICS.calculus);
        session.start_topic = toggled;
        await saveSession(session);
        return renderPlan(toggled);
      }
      if (choiceNumber === 3) {
        await endSession(session.id);
        await clearPanicState(user.id);
        return `No stress. If panic hits again, just type "panic". 💪`;
      }
      return `Please choose: 1) Start now 2) Switch topic 3) Cancel`;
    }

    if (step === 'micro_module') {
      // 1) Start 3Q burst 2) Extra example 3) Cancel
      if (choiceNumber === 1) {
        return await this.beginBurst(user, session);
      }
      if (choiceNumber === 2) {
        // Send extra example then keep them in micro_module step
        return renderMicroModuleExtra(session.start_topic || TOPICS.calculus);
      }
      if (choiceNumber === 3) {
        await endSession(session.id);
        await clearPanicState(user.id);
        return `Okay, we’ll pause here. Type "panic" anytime to jump back in.`;
      }
      return `Choose 1) Start 3Q burst 2) Extra example 3) Cancel`;
    }

    if (step === 'burst') {
      // In case they press numbers unexpectedly during burst, ignore and remind
      return `We’re mid-burst. Answer with A, B, C, or D.`;
    }

    if (step === 'momentum_menu') {
      // 1) Continue same topic 2) Switch topic 3) Take a break 4) Reminder tonight
      if (choiceNumber === 1) {
        return await this.beginBurst(user, session, { resetScore: true });
      }
      if (choiceNumber === 2) {
        session.start_topic = toggleTopic(session.start_topic || TOPICS.calculus);
        await saveSession(session);
        return await this.beginBurst(user, session, { resetScore: true });
      }
      if (choiceNumber === 3) {
        session.next_action_1 = 'break';
        await saveSession(session);
        await endSession(session.id);
        await clearPanicState(user.id);
        return `Break is valid. Come back strong later. Type "next" when ready. 💪`;
      }
      if (choiceNumber === 4) {
        await optInReminder(session, user.id);
        session.reminder_opt_in = true;
        await saveSession(session);
        await endSession(session.id);
        await clearPanicState(user.id);
        return `Lekker, I’ll remind you this evening. You’ve got this. 🔔`;
      }
      return `Pick 1) Continue 2) Switch topic 3) Break 4) Reminder`;
    }

    // Default fallback
    return `Eish, I didn’t catch that. Use the numbered options above.`;
  },

  // Start or continue a 3-question burst
  async beginBurst(user, session, options = {}) {
    const topic = session.start_topic || TOPICS.calculus;

    // Reset/initialise burst state
    const usedIds = new Set(session.session_state?.used_question_ids || []);
    const burstIndex = options.resetScore ? 0 : session.session_state?.burst_index || 0;
    const correctCount = options.resetScore ? 0 : session.session_state?.correct_count || 0;

    session.session_state = {
      step: 'burst',
      topic,
      burst_index: burstIndex,
      correct_count: correctCount,
      used_question_ids: Array.from(usedIds)
    };
    await saveSession(session);

    // Fetch an easy question from the topic
    const question = await getEasyTopicQuestion(user, topic, usedIds);

    if (!question) {
      // fallback to any easy math question
      const fallback = await questionService.getRandomQuestion(user, {
        subject: 'math',
        difficulty: 'easy',
        excludeRecent: false
      });
      if (!fallback) {
        // Hard fail
        session.session_state = { step: 'momentum_menu' };
        await saveSession(session);
        return `No questions available right now. Try again later or type "menu".`;
      }
      await questionService.serveQuestionToUser(user.id, fallback.id);
      trackUsed(session, fallback.id);
      return `🎯 3Q Burst – Question ${burstIndex + 1} of 3\n\n${formatQuestion(fallback)}`;
    }

    await questionService.serveQuestionToUser(user.id, question.id);
    trackUsed(session, question.id);
    return `🎯 3Q Burst – Question ${burstIndex + 1} of 3\n\n${formatQuestion(question)}`;
  },

  // Answer handler while in panic burst
  async handleAnswer(user, answerLetter) {
    // Load current session
    const session = await getOrCreateActivePanicSession(user.id);
    const state = session.session_state || {};
    if (state.step !== 'burst' || !user.current_question_id) {
      // Not in burst; hand back to normal flow
      return `To continue, type "panic" to start or "menu" for options.`;
    }

    // Fetch the current question and check correctness
    const { question, correct } = await fetchQuestionAndCheck(
      user.current_question_id,
      answerLetter
    );

    // Record response + update stats
    await recordResponseAndStats(user.id, question, answerLetter, correct);

    // Update burst counters
    const idx = (state.burst_index || 0) + 1;
    const correctCount = (state.correct_count || 0) + (correct ? 1 : 0);
    session.session_state.burst_index = idx;
    session.session_state.correct_count = correctCount;
    await saveSession(session);

    // Feedback line
    const feedback = correct
      ? `💯 Nice! Correct.`
      : `Aweh, not this time. Correct answer was ${String(question.correct_choice).toUpperCase()}.`;

    // If finished 3 questions, wrap and momentum menu
    if (idx >= 3) {
      // Persist score
      if (session.burst_score_1 == null) {
        session.burst_score_1 = correctCount;
      }
      session.session_state = { step: 'momentum_menu' };
      await saveSession(session);

      return (
        `${feedback}\n\n` +
        `✅ Burst done: ${correctCount}/3\n\n` +
        `What next?\n` +
        `1) Continue same topic\n` +
        `2) Switch topic\n` +
        `3) Take a break\n` +
        `4) Remind me tonight`
      );
    }

    // Else serve next question
    const topic = session.start_topic || TOPICS.calculus;
    const usedIds = new Set(session.session_state?.used_question_ids || []);
    const nextQ = await getEasyTopicQuestion(user, topic, usedIds);

    if (!nextQ) {
      // fallback any easy
      const fallback = await questionService.getRandomQuestion(user, {
        subject: 'math',
        difficulty: 'easy',
        excludeRecent: false
      });
      if (!fallback) {
        session.session_state = { step: 'momentum_menu' };
        await saveSession(session);
        return (
          `${feedback}\n\n` +
          `No more questions available right now.\n\n` +
          `1) Continue (when available)\n2) Switch topic\n3) Break\n4) Reminder tonight`
        );
      }
      await questionService.serveQuestionToUser(user.id, fallback.id);
      trackUsed(session, fallback.id);
      return `${feedback}\n\n🎯 Question ${idx + 1} of 3\n\n${formatQuestion(fallback)}`;
    }

    await questionService.serveQuestionToUser(user.id, nextQ.id);
    trackUsed(session, nextQ.id);
    return `${feedback}\n\n🎯 Question ${idx + 1} of 3\n\n${formatQuestion(nextQ)}`;
  }
};

// ---------- Helpers ----------

async function getOrCreateActivePanicSession(userId) {
  return await executeQuery(async (supabase) => {
    // Find existing active
    const { data: existing } = await supabase
      .from('panic_sessions')
      .select('*')
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) return existing;

    // Create new
    const { data: created, error } = await supabase
      .from('panic_sessions')
      .insert({
        user_id: userId,
        subject: 'math',
        start_topic: 'unknown',
        session_state: { step: 'ask_level' }
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
        panic_level: session.panic_level ?? null,
        subject: session.subject || 'math',
        start_topic: session.start_topic || 'unknown',
        burst_score_1: session.burst_score_1 ?? null,
        next_action_1: session.next_action_1 ?? null,
        reminder_opt_in: session.reminder_opt_in ?? false,
        session_state: session.session_state || {},
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id);
    if (error) throw error;
  });
}

async function endSession(sessionId) {
  return await executeQuery(async (supabase) => {
    const { error } = await supabase
      .from('panic_sessions')
      .update({ ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', sessionId);
    if (error) throw error;
  });
}

async function markUserInPanic(userId, sessionId) {
  await updateUser(userId, {
    current_menu: 'panic',
    panic_session_id: sessionId,
    last_active_at: new Date().toISOString()
  });
}

async function clearPanicState(userId) {
  await updateUser(userId, {
    current_menu: 'main',
    panic_session_id: null,
    last_active_at: new Date().toISOString()
  });
}

function toggleTopic(topic) {
  if (topic === TOPICS.trigonometry) return TOPICS.calculus;
  return TOPICS.trigonometry;
}

function renderPlan(topic) {
  const topicName = topic === TOPICS.trigonometry ? 'Trigonometry' : 'Calculus';
  return (
    `🧭 PLAN ( ${topicName} )\n\n` +
    `Now (~20 min): Quick crash course + 3Q burst\n` +
    `Tonight: Short practice on the other topic\n` +
    `Tomorrow: Review + mini-mock\n\n` +
    `Start now?\n` +
    `1) Yes, start\n` +
    `2) Switch topic\n` +
    `3) Cancel`
  );
}

function renderMicroModuleIntro(topic) {
  const isCalc = topic !== TOPICS.trigonometry;
  if (isCalc) {
    return (
      `📘 Calculus (First Principles) – Micro-Module\n\n` +
      `• Pattern: f'(x) = lim_{h->0} (f(x+h) - f(x)) / h\n` +
      `• Simplify: Expand, cancel terms, factor h, then take the limit\n` +
      `• Timing: Work step-by-step; avoid skipping algebra\n\n` +
      `Quick lesson:\n` +
      `Derivative from first principles uses the definition above. For f(x)=x^2:\n` +
      `f(x+h) = (x+h)^2 = x^2 + 2xh + h^2\n` +
      `So f(x+h)-f(x) = 2xh + h^2. Divide by h -> 2x + h; limit h->0 -> 2x\n\n` +
      `Worked example:\n` +
      `Find derivative of f(x)=3x^2:\n` +
      `f(x+h)-f(x) = 3[(x+h)^2 - x^2] = 3(2xh + h^2)\n` +
      `Divide by h: 3(2x + h) -> limit -> 6x\n\n` +
      `1) Start 3Q burst\n2) Extra example\n3) Cancel`
    );
  } else {
    return (
      `📗 Trigonometry Identity – Micro-Module\n\n` +
      `• Core: sin^2(x) + cos^2(x) = 1\n` +
      `• Strategy: Convert everything to sin and cos, then simplify\n` +
      `• Tip: Watch angle units and common values (0, 30, 45, 60, 90)\n\n` +
      `Quick lesson:\n` +
      `Use sin^2 + cos^2 = 1 to reduce expressions. Example:\n` +
      `Given 1 - cos^2(x) = sin^2(x). So if an expression has 1 - cos^2(x), replace with sin^2(x)\n\n` +
      `Worked example:\n` +
      `Simplify: (1 - cos^2 x)/sin x = sin^2 x / sin x = sin x\n\n` +
      `1) Start 3Q burst\n2) Extra example\n3) Cancel`
    );
  }
}

function renderMicroModuleExtra(topic) {
  const isCalc = topic !== TOPICS.trigonometry;
  if (isCalc) {
    return (
      `Extra example (Calculus):\n` +
      `f(x)=x^3 -> f(x+h)-f(x) = (x+h)^3 - x^3 = 3x^2 h + 3x h^2 + h^3\n` +
      `Divide by h: 3x^2 + 3x h + h^2 -> limit -> 3x^2\n\n` +
      `Ready?\n1) Start 3Q burst\n2) Another extra\n3) Cancel`
    );
  } else {
    return (
      `Extra example (Trig):\n` +
      `Simplify: (cos^2 x - 1)/cos x = -(1 - cos^2 x)/cos x = -(sin^2 x)/cos x\n` +
      `= -(sin x)(sin x / cos x) = -(sin x)(tan x)\n\n` +
      `Ready?\n1) Start 3Q burst\n2) Another extra\n3) Cancel`
    );
  }
}

async function getEasyTopicQuestion(user, topic, usedIds = new Set()) {
  // Prefer topic-specific
  const q = await questionService.getQuestionByTopic(user, topic, {
    subject: 'math',
    difficulty: 'easy',
    excludeRecent: true
  });
  if (q && !usedIds.has(q.id)) return q;

  // Fallback: any easy math
  const any = await questionService.getRandomQuestion(user, {
    subject: 'math',
    difficulty: 'easy',
    excludeRecent: true
  });
  if (any && !usedIds.has(any.id)) return any;
  return null;
}

function trackUsed(session, questionId) {
  const used = new Set(session.session_state?.used_question_ids || []);
  used.add(questionId);
  session.session_state.used_question_ids = Array.from(used);
  // fire and forget
  saveSession(session).catch(() => {});
}

async function fetchQuestionAndCheck(questionId, answerLetter) {
  return await executeQuery(async (supabase) => {
    const { data: question, error } = await supabase
      .from('mcqs')
      .select('id, correct_choice')
      .eq('id', questionId)
      .single();
    if (error || !question) throw new Error('Question not found for answer check');

    const correctChoice = String(question.correct_choice || '')
      .toUpperCase()
      .trim();
    const userAns = String(answerLetter || '')
      .toUpperCase()
      .trim();
    const correct = userAns === correctChoice;

    return { question, correct, correctChoice };
  });
}

async function recordResponseAndStats(userId, question, answer, isCorrect) {
  try {
    await questionService.recordUserResponse(
      userId,
      question.id,
      String(answer).toUpperCase(),
      isCorrect,
      null
    );
  } catch (e) {
    // non-fatal
    console.warn('recordUserResponse failed (non-fatal):', e?.message);
  }
}

/**
 * Store a minimal reminder row and/or set a flag.
 * MVP keeps it as a flag; optionally write a reminders row for future.
 */
async function optInReminder(session, userId) {
  session.reminder_opt_in = true;

  // Optional: create a reminders row for "this evening"
  try {
    const scheduledFor = getEveningInUTC();
    await executeQuery(async (supabase) => {
      await supabase.from('reminders').insert({
        user_id: userId,
        type: 'panic_evening',
        scheduled_for: scheduledFor.toISOString(),
        metadata: { session_id: session.id, source: 'panic_momentum' }
      });
    });
  } catch (e) {
    // Non-fatal; keep the flag only
    console.warn('reminder insert failed (non-fatal):', e?.message);
  }
}

function getEveningInUTC() {
  // Simple: schedule for 19:00 UTC today if still ahead, else tomorrow 19:00 UTC
  const now = new Date();
  const target = new Date(now);
  target.setUTCHours(19, 0, 0, 0);
  if (target <= now) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target;
}
