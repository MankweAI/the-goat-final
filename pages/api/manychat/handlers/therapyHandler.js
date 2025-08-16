/**
 * Therapy Handler (Lean MVP)
 * Flow: reason -> pre-confidence -> micro-support (GPT) -> ladder (R1/R2/R3) -> post-confidence -> close
 * Data: persists to therapy_sessions; users.current_menu = 'therapy'
 */

import { executeQuery } from '../config/database.js';
import { updateUser } from '../services/userService.js';
import { questionService } from '../services/questionService.js';
import { aiService } from '../services/aiService.js';
import { formatQuestion } from '../utils/questionFormatter.js';

const REASONS = ['failed', 'confused', 'comparison', 'comment', 'other'];

export const therapyHandler = {
  // Entry
  async startTherapy(user) {
    const session = await getOrCreateActiveTherapySession(user.id);
    session.session_state = { step: 'ask_reason' };
    await saveSession(session);
    await markUserInTherapy(user.id, session.id);

    return (
      `🧠 THERAPY (Academic Confidence)\n` +
      `What's making you feel this way?\n` +
      `1) Failed\n2) Confused\n3) Comparison\n4) Comment\n5) Other`
    );
  },

  // Handle numeric choices inside therapy flow
  async handleMenu(user, choiceNumber) {
    const session = await getOrCreateActiveTherapySession(user.id);
    const state = session.session_state || {};
    const step = state.step || 'ask_reason';

    if (step === 'ask_reason') {
      const idx = parseInt(choiceNumber, 10);
      if (isNaN(idx) || idx < 1 || idx > 5) {
        return `Please choose 1–5 for the reason.`;
      }
      session.reason = REASONS[idx - 1];
      session.session_state = { step: 'ask_pre_confidence' };
      await saveSession(session);

      return `On a scale 1–5, how confident do you feel right now?\n` + `1) Low … 5) High`;
    }

    if (step === 'ask_pre_confidence') {
      const lvl = parseInt(choiceNumber, 10);
      if (isNaN(lvl) || lvl < 1 || lvl > 5) {
        return `Choose 1–5 for your current confidence.`;
      }
      session.pre_confidence = lvl;

      // Generate a short supportive GPT line
      const support = await aiService.generateTherapySupport(
        {
          id: user.id,
          username: user.username,
          grade: user.grade,
          streak_count: user.streak_count || 0
        },
        session.reason,
        lvl
      );

      session.session_state = { step: 'ladder_menu', last_support: support };
      await saveSession(session);

      return (
        `Sharp. Here’s a quick support line:\n` +
        `“${support}”\n\n` +
        `Confidence Ladder – pick a step:\n` +
        `1) R1: 3 easy wins (quick 3Q burst)\n` +
        `2) R2: Explain a concept you know (reflection)\n` +
        `3) R3: 1 slightly harder question\n` +
        `4) Skip to finish`
      );
    }

    if (step === 'ladder_menu') {
      if (choiceNumber === 1) {
        // R1: 3 easy wins
        session.ladder_action = 'r1';
        session.session_state = {
          step: 'r1_burst',
          burst_index: 0,
          correct_count: 0,
          used_question_ids: []
        };
        await saveSession(session);
        return await this._serveTherapyQuestion(user, session, { difficulty: 'easy' });
      }
      if (choiceNumber === 2) {
        // R2: Reflection (no question required)
        session.ladder_action = 'r2';
        session.session_state = { step: 'post_confidence_prompt' };
        await saveSession(session);
        return (
          `R2 Reflection:\n` +
          `Think of a maths concept you’re solid in (e.g., factorising).\n` +
          `Explain it in one sentence to yourself. That’s your proof you can learn.\n\n` +
          `Now rate your confidence again (1–5).`
        );
      }
      if (choiceNumber === 3) {
        // R3: 1 slightly harder question
        session.ladder_action = 'r3';
        session.session_state = { step: 'r3_question', used_question_ids: [] };
        await saveSession(session);
        return await this._serveTherapyQuestion(user, session, { difficulty: 'medium' });
      }
      if (choiceNumber === 4) {
        // Skip to finish -> ask post-confidence
        session.session_state = { step: 'post_confidence_prompt' };
        await saveSession(session);
        return `No stress. Rate your confidence now (1–5).`;
      }
      return `Choose 1–4 for the ladder step.`;
    }

    if (step === 'post_confidence_prompt') {
      const lvl = parseInt(choiceNumber, 10);
      if (isNaN(lvl) || lvl < 1 || lvl > 5) {
        return `Choose 1–5 for your current confidence.`;
      }
      session.post_confidence = lvl;
      await saveSession(session);
      await endTherapy(session.id);
      await clearTherapyState(user.id);

      const delta = session.pre_confidence && lvl ? lvl - session.pre_confidence : null;
      const deltaLine =
        delta == null
          ? ''
          : delta > 0
            ? `Up by ${delta}. 🔼`
            : delta < 0
              ? `Down by ${Math.abs(delta)}. 🔽`
              : `No change. ➡️`;

      return (
        `Lekker. Confidence now: ${lvl}. ${deltaLine}\n\n` +
        `Proud of you for taking a step. Type "next" for a practice question or "menu" for options.`
      );
    }

    return `Use the numbered options above to continue.`;
  },

  // Handle answer during therapy R1/R3
  async handleAnswer(user, answerLetter) {
    const session = await getOrCreateActiveTherapySession(user.id);
    const state = session.session_state || {};

    // R1 burst (3 easy)
    if (state.step === 'r1_burst' && user.current_question_id) {
      const { question, correct } = await fetchQuestionAndCheck(
        user.current_question_id,
        answerLetter
      );
      await recordResponseAndStats(user.id, question, answerLetter, correct);

      const idx = (state.burst_index || 0) + 1;
      const correctCount = (state.correct_count || 0) + (correct ? 1 : 0);

      session.session_state.burst_index = idx;
      session.session_state.correct_count = correctCount;
      await saveSession(session);

      const feedback = correct
        ? `💯 Sharp! Correct.`
        : `Aweh, not this time. Correct was ${String(question.correct_choice).toUpperCase()}.`;

      if (idx >= 3) {
        // Done with R1; ask post-confidence
        session.session_state = { step: 'post_confidence_prompt' };
        await saveSession(session);
        return `${feedback}\n\n✅ 3 easy wins complete: ${correctCount}/3.\n\nHow’s your confidence now (1–5)?`;
      }

      // Serve next easy
      const qText = await this._serveTherapyQuestion(user, session, { difficulty: 'easy' });
      return `${feedback}\n\n${qText}`;
    }

    // R3 single medium
    if (state.step === 'r3_question' && user.current_question_id) {
      const { question, correct } = await fetchQuestionAndCheck(
        user.current_question_id,
        answerLetter
      );
      await recordResponseAndStats(user.id, question, answerLetter, correct);

      session.session_state = { step: 'post_confidence_prompt' };
      await saveSession(session);

      const feedback = correct
        ? `💯 Nice! That was a tougher one.`
        : `All good—medium questions are meant to stretch you. Correct was ${String(question.correct_choice).toUpperCase()}.`;

      return `${feedback}\n\nRate your confidence now (1–5).`;
    }

    return `Type "therapy" to start or use "menu" for other options.`;
  },

  async _serveTherapyQuestion(user, session, { difficulty }) {
    // Try using last known topic in session_state; fallback to user's current_topic or math random easy/medium
    const topic = session.session_state?.topic || session.start_topic || user.current_topic || null;

    let q = null;
    if (topic && topic !== 'unknown') {
      q = await questionService.getQuestionByTopic(user, topic, {
        subject: 'math',
        difficulty,
        excludeRecent: true
      });
    }
    if (!q) {
      q = await questionService.getRandomQuestion(user, {
        subject: 'math',
        difficulty,
        excludeRecent: true
      });
    }
    if (!q) {
      return `No question available right now. Try again later.`;
    }

    await questionService.serveQuestionToUser(user.id, q.id);
    return formatQuestion(q);
  }
};

// ---------- Helpers ----------

async function getOrCreateActiveTherapySession(userId) {
  return await executeQuery(async (supabase) => {
    const { data: existing } = await supabase
      .from('therapy_sessions')
      .select('*')
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) return existing;

    const { data: created, error } = await supabase
      .from('therapy_sessions')
      .insert({
        user_id: userId,
        reason: 'other',
        pre_confidence: 3,
        session_state: { step: 'ask_reason' }
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
      .from('therapy_sessions')
      .update({
        reason: session.reason,
        pre_confidence: session.pre_confidence ?? null,
        post_confidence: session.post_confidence ?? null,
        ladder_action: session.ladder_action ?? null,
        session_state: session.session_state || {},
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id);
    if (error) throw error;
  });
}

async function endTherapy(sessionId) {
  return await executeQuery(async (supabase) => {
    const { error } = await supabase
      .from('therapy_sessions')
      .update({ ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', sessionId);
    if (error) throw error;
  });
}

async function markUserInTherapy(userId, sessionId) {
  await updateUser(userId, {
    current_menu: 'therapy',
    therapy_session_id: sessionId,
    last_active_at: new Date().toISOString()
  });
}

async function clearTherapyState(userId) {
  await updateUser(userId, {
    current_menu: 'main',
    therapy_session_id: null,
    last_active_at: new Date().toISOString()
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
    console.warn('recordUserResponse failed (non-fatal):', e?.message);
  }
}
