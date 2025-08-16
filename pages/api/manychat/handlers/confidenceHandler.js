/**
 * Confidence Boost Handler (Formerly Therapy)
 * Date: 2025-08-16 16:53:38 UTC
 * Flow: Reason → Pre-Confidence → Micro-Support → Ladder → Post-Confidence
 */

import { executeQuery } from '../config/database.js';
import { updateUser } from '../services/userService.js';
import { questionService } from '../services/questionService.js';
import { aiService } from '../services/aiService.js';
import { formatQuestion } from '../utils/questionFormatter.js';
import { CONSTANTS, MESSAGES } from '../config/constants.js';

export const confidenceHandler = {
  // Entry point
  async startConfidenceBoost(user) {
    const session = await getOrCreateActiveConfidenceSession(user.id);

    session.session_state = { step: 'ask_reason' };
    await saveSession(session);
    await markUserInConfidenceFlow(user.id, session.id);

    return MESSAGES.CONFIDENCE.REASON_PROMPT;
  },

  // Handle menu choices in confidence flow
  async handleConfidenceMenu(user, choice) {
    const session = await getOrCreateActiveConfidenceSession(user.id);
    const state = session.session_state || {};
    const step = state.step || 'ask_reason';

    console.log(`🔍 Confidence flow: step=${step}, choice=${choice}`);

    if (step === 'ask_reason') {
      if (choice >= 1 && choice <= 5) {
        const reasons = ['failed', 'confused', 'comparison', 'comment', 'other'];
        session.reason = reasons[choice - 1];
        session.session_state = { step: 'ask_pre_confidence' };
        await saveSession(session);
        await updateUser(user.id, { current_menu: 'confidence_pre' });

        return MESSAGES.CONFIDENCE.PRE_CONFIDENCE_PROMPT;
      }
      return `Please pick a number 1–5 for what's weighing on you. 🫶`;
    }

    if (step === 'ask_pre_confidence') {
      if (choice >= 1 && choice <= 5) {
        session.pre_confidence = choice;
        session.session_state = { step: 'generate_support' };
        await saveSession(session);

        // Generate GPT micro-support
        return await this.generateMicroSupport(user, session);
      }
      return `Please rate your confidence 1–5 right now. 🧠`;
    }

    if (step === 'show_ladder') {
      if (choice >= 1 && choice <= 4) {
        const actions = ['r1_easy', 'r2_reflect', 'r3_medium', 'skip'];
        return await this.handleLadderChoice(user, session, actions[choice - 1]);
      }
      return `Please pick 1, 2, 3, or 4 from the confidence ladder. ✨`;
    }

    if (step === 'ask_post_confidence') {
      if (choice >= 1 && choice <= 5) {
        session.post_confidence = choice;
        await saveSession(session);

        return await this.completeConfidenceSession(user, session);
      }
      return `Please rate your confidence 1–5 now. 🌱`;
    }

    return `I didn't catch that. Let's try again. 🫶`;
  },

  // Generate micro-support using GPT
  async generateMicroSupport(user, session) {
    try {
      const supportMessage = await aiService.generateTherapySupport(
        {
          id: user.id,
          username: user.username || 'student',
          grade: user.grade || '10',
          streak_count: user.streak_count || 0
        },
        session.reason,
        session.pre_confidence
      );

      session.session_state = {
        ...session.session_state,
        step: 'show_ladder',
        support_message: supportMessage
      };
      await saveSession(session);
      await updateUser(user.id, { current_menu: 'confidence_ladder' });

      return (
        `Here's a thought for you:\n\n` +
        `"${supportMessage}"\n\n` +
        `${MESSAGES.CONFIDENCE.LADDER_PROMPT}`
      );
    } catch (error) {
      console.error('❌ Micro-support generation failed:', error);

      // Fallback support message
      const fallbackSupport = `You're not behind—you're starting now. That matters. 🌱`;

      session.session_state = {
        ...session.session_state,
        step: 'show_ladder',
        support_message: fallbackSupport
      };
      await saveSession(session);
      await updateUser(user.id, { current_menu: 'confidence_ladder' });

      return (
        `Here's a thought for you:\n\n` +
        `"${fallbackSupport}"\n\n` +
        `${MESSAGES.CONFIDENCE.LADDER_PROMPT}`
      );
    }
  },

  // Handle ladder choice (R1/R2/R3/Skip)
  async handleLadderChoice(user, session, action) {
    session.ladder_action = action;
    session.session_state = { ...session.session_state, ladder_action: action };
    await saveSession(session);

    if (action === 'r1_easy') {
      // R1: Easy practice questions
      return await this.startEasyPractice(user, session);
    }

    if (action === 'r2_reflect') {
      // R2: Reflection exercise
      session.session_state.step = 'ask_post_confidence';
      await saveSession(session);
      await updateUser(user.id, { current_menu: 'confidence_post' });

      return `${MESSAGES.CONFIDENCE.REFLECTION_PROMPT}`;
    }

    if (action === 'r3_medium') {
      // R3: One medium challenge
      return await this.startMediumChallenge(user, session);
    }

    if (action === 'skip') {
      // Skip to post-confidence check
      session.session_state.step = 'ask_post_confidence';
      await saveSession(session);
      await updateUser(user.id, { current_menu: 'confidence_post' });

      return `No stress. Let's check in.\n\n${MESSAGES.CONFIDENCE.POST_CONFIDENCE_PROMPT}`;
    }

    return `Something went wrong. Let's try again. 🌱`;
  },

  // R1: Start easy practice
  async startEasyPractice(user, session) {
    const question = await questionService.getRandomQuestion(user, {
      subject: 'math',
      difficulty: 'easy',
      excludeRecent: true
    });

    if (!question) {
      session.session_state.step = 'ask_post_confidence';
      await saveSession(session);
      await updateUser(user.id, { current_menu: 'confidence_post' });

      return `No easy practice available right now.\n\n${MESSAGES.CONFIDENCE.POST_CONFIDENCE_PROMPT}`;
    }

    await questionService.serveQuestionToUser(user.id, question.id);
    await updateUser(user.id, { current_menu: 'confidence_practice' });

    session.session_state = {
      ...session.session_state,
      step: 'r1_practice',
      practice_questions_done: 0,
      practice_questions_correct: 0,
      max_practice_questions: 3
    };
    await saveSession(session);

    return `Let's build confidence with gentle practice. Here's an easy one:\n\n${formatQuestion(question)}`;
  },

  // R3: Start medium challenge
  async startMediumChallenge(user, session) {
    const question = await questionService.getRandomQuestion(user, {
      subject: 'math',
      difficulty: 'medium',
      excludeRecent: true
    });

    if (!question) {
      session.session_state.step = 'ask_post_confidence';
      await saveSession(session);
      await updateUser(user.id, { current_menu: 'confidence_post' });

      return `No medium questions available right now.\n\n${MESSAGES.CONFIDENCE.POST_CONFIDENCE_PROMPT}`;
    }

    await questionService.serveQuestionToUser(user.id, question.id);
    await updateUser(user.id, { current_menu: 'confidence_practice' });

    session.session_state = {
      ...session.session_state,
      step: 'r3_practice'
    };
    await saveSession(session);

    return `Here's a medium challenge to stretch your abilities:\n\n${formatQuestion(question)}`;
  },

  // Handle practice answers
  async handlePracticeAnswer(user, answerLetter) {
    const session = await getOrCreateActiveConfidenceSession(user.id);
    const state = session.session_state || {};

    if (!user.current_question_id) {
      return `No active question. Type "boost" to restart confidence support. 🫶`;
    }

    // Check answer
    const { question, correct } = await fetchQuestionAndCheck(
      user.current_question_id,
      answerLetter
    );

    // Record response
    await questionService.recordUserResponse(user.id, question.id, answerLetter, correct, null);

    if (state.step === 'r1_practice') {
      // Easy practice (R1) - track progress
      const done = (state.practice_questions_done || 0) + 1;
      const correctCount = (state.practice_questions_correct || 0) + (correct ? 1 : 0);
      const maxQuestions = state.max_practice_questions || 3;

      const feedback = correct
        ? `✅ Nice! That's building confidence. You're getting the hang of this. 🌱`
        : `Not quite, but you're learning. Keep going—each attempt makes you stronger. ✨`;

      if (done >= maxQuestions) {
        // R1 practice complete
        session.session_state.step = 'ask_post_confidence';
        await saveSession(session);
        await updateUser(user.id, { current_menu: 'confidence_post', current_question_id: null });

        return `${feedback}\n\n✅ Gentle practice complete: ${correctCount}/${maxQuestions}\n\n${MESSAGES.CONFIDENCE.POST_CONFIDENCE_PROMPT}`;
      } else {
        // Get next easy question
        const nextQuestion = await questionService.getRandomQuestion(user, {
          subject: 'math',
          difficulty: 'easy',
          excludeRecent: true
        });

        if (nextQuestion) {
          await questionService.serveQuestionToUser(user.id, nextQuestion.id);
          session.session_state = {
            ...state,
            practice_questions_done: done,
            practice_questions_correct: correctCount
          };
          await saveSession(session);

          return `${feedback}\n\nQuestion ${done + 1} of ${maxQuestions}:\n\n${formatQuestion(nextQuestion)}`;
        } else {
          // No more questions - finish early
          session.session_state.step = 'ask_post_confidence';
          await saveSession(session);
          await updateUser(user.id, { current_menu: 'confidence_post', current_question_id: null });

          return `${feedback}\n\n✅ Good work so far.\n\n${MESSAGES.CONFIDENCE.POST_CONFIDENCE_PROMPT}`;
        }
      }
    }

    if (state.step === 'r3_practice') {
      // Medium challenge (R3) - single question
      const feedback = correct
        ? `💪 Excellent! That was a tougher one and you handled it well. You're growing. 🌱`
        : `That was challenging, and challenging yourself is brave. The correct answer was ${question.correct_choice}. 🧠`;

      session.session_state.step = 'ask_post_confidence';
      await saveSession(session);
      await updateUser(user.id, { current_menu: 'confidence_post', current_question_id: null });

      return `${feedback}\n\n${MESSAGES.CONFIDENCE.POST_CONFIDENCE_PROMPT}`;
    }

    return `Something went wrong. Let's check your confidence level.\n\n${MESSAGES.CONFIDENCE.POST_CONFIDENCE_PROMPT}`;
  },

  // Complete confidence session with delta analysis
  async completeConfidenceSession(user, session) {
    const preConfidence = session.pre_confidence || 3;
    const postConfidence = session.post_confidence || 3;
    const delta = postConfidence - preConfidence;

    // Store final state
    await saveSession(session);
    await endConfidenceSession(session.id);
    await clearConfidenceState(user.id);

    let deltaMessage = '';
    if (delta > 0) {
      deltaMessage = `Up by ${delta}—great. That's how confidence builds. 🌱`;
    } else if (delta < 0) {
      deltaMessage = `Down by ${Math.abs(delta)}, and that's okay. Some days are tougher. 🫶`;
    } else {
      deltaMessage = `Steady confidence. Consistent work pays off. ✨`;
    }

    return (
      `Confidence check complete.\n\n` +
      `Before: ${preConfidence}/5\n` +
      `Now: ${postConfidence}/5\n` +
      `${deltaMessage}\n\n` +
      `You took a step today. That matters.\n\n` +
      `Type "practice" for questions or "menu" for options. 🧠`
    );
  }
};

// Helper functions
async function getOrCreateActiveConfidenceSession(userId) {
  return await executeQuery(async (supabase) => {
    const { data: existing } = await supabase
      .from('therapy_sessions') // Keep table name for backward compatibility
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
        pre_confidence: 3, // Default value
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
        pre_confidence: session.pre_confidence || null,
        post_confidence: session.post_confidence || null,
        ladder_action: session.ladder_action || null,
        session_state: session.session_state || {},
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id);
    if (error) throw error;
  });
}

async function markUserInConfidenceFlow(userId, sessionId) {
  await updateUser(userId, {
    current_menu: 'confidence_reason',
    therapy_session_id: sessionId, // Keep field name for compatibility
    last_active_at: new Date().toISOString()
  });
}

async function clearConfidenceState(userId) {
  await updateUser(userId, {
    current_menu: 'welcome',
    therapy_session_id: null,
    current_question_id: null,
    last_active_at: new Date().toISOString()
  });
}

async function endConfidenceSession(sessionId) {
  return await executeQuery(async (supabase) => {
    const { error } = await supabase
      .from('therapy_sessions')
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