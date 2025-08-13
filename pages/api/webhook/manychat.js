// Multi-Subject Proactive Flow Webhook for The GOAT
// (Build fix: allow reassignment of question in handleAnsweredQuestion)
// Date: 2025-08-13
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const USER_STATES = {
  IDLE: 'idle',
  CONSENT_PENDING: 'consent_pending',
  SUBJECT_SELECTION: 'subject_selection',
  TIME_PREFERENCE: 'time_preference',
  HOOK_SENT: 'hook_sent',
  QUESTION_SENT: 'question_sent',
  ANSWERED_QUESTION: 'answered_question',
  ADDITIONAL_QUESTION_SENT: 'additional_question_sent',
  DECLINED_DAILY: 'declined_daily',
  SESSION_COMPLETE: 'session_complete'
};

const INPUT_PATTERNS = {
  YES: /^(yes|y|yep|sure|ja|yebo|yeah|ok|okay|👍)$/i,
  NO: /^(no|n|nah|not now|later|nie|nope|❌)$/i,
  MORE: /^(more|another|next|continue|again|keep going)$/i,
  STOP: /^(stop|done|enough|finished|quit|end)$/i,
  START: /^(start|begin|hi|hello|howzit|aweh)$/i,
  ANSWER: /^[abcd][\)\.]?$/i,
  TIME: /^([01]?[0-9]|2[0-3])$/
};

const PERSONA_RESPONSES = {
  WELCOME: [
    "Howzit legend! 🐐 I'm The GOAT - your daily practice partner for acing those exams.",
    'Aweh! Welcome to The GOAT family 🔥 Ready to level up your knowledge game?',
    "Yebo! You've just met your new study buddy. The GOAT is here to make learning lekker! 💪"
  ],
  HOOK_CTAS: [
    'Keen for a quick challenge? Reply YES 👍',
    'Up for testing that? Reply YES 🎯',
    'Want to put that to practice? Reply YES 💪',
    'Ready to flex those skills? Reply YES 🔥'
  ],
  MORE_CTAS: [
    'Up for another round? Reply MORE 🚀',
    'Want to keep the momentum? Reply MORE 💫',
    'Ready for the next challenge? Reply MORE ⚡',
    'Feeling sharp? Reply MORE for another 🎯'
  ],
  DECLINE_RESPONSES: [
    'No stress! Catch you tomorrow 🤙',
    'All good! See you tomorrow 👊',
    'No worries! Tomorrow it is 🤝',
    'Sharp! Back tomorrow then 🐐'
  ],
  CORRECT_RESPONSES: [
    '🔥 Yebo! You nailed it!',
    "Sharp! That's the one! 💪",
    "Eish, you're on fire! 🚀",
    'Legend! Spot on! ⚡'
  ],
  INCORRECT_RESPONSES: ['Aweh, close one!', 'Eish, good attempt!', 'Sharp try!', 'Almost had it!'],
  COMPLETION: [
    'Legend! You crushed it today. See you tomorrow for another brain workout 🧠💪',
    'Yebo! Solid session today. Tomorrow we go again 🔥',
    "Sharp work! Rest those brain muscles, tomorrow's another level 🚀"
  ]
};

function normalizeUserInput(message) {
  if (!message) return '';
  const cleaned = message.trim().toLowerCase();
  if (INPUT_PATTERNS.ANSWER.test(cleaned)) return cleaned.charAt(0).toUpperCase();
  if (INPUT_PATTERNS.YES.test(cleaned)) return 'YES';
  if (INPUT_PATTERNS.NO.test(cleaned)) return 'NO';
  if (INPUT_PATTERNS.MORE.test(cleaned)) return 'MORE';
  if (INPUT_PATTERNS.STOP.test(cleaned)) return 'STOP';
  if (INPUT_PATTERNS.START.test(cleaned)) return 'START';
  if (INPUT_PATTERNS.TIME.test(cleaned)) return 'TIME';
  return cleaned;
}
function getRandomResponse(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function logEvent(eventType, userId, metadata = {}) {
  try {
    await supabase.from('events').insert({ user_id: userId, event_type: eventType, metadata });
  } catch (e) {
    console.error('logEvent error', e);
  }
}

async function updateUserState(userId, newState, updates = {}) {
  try {
    const { error } = await supabase
      .from('users')
      .update({ current_state: newState, last_active_at: new Date().toISOString(), ...updates })
      .eq('id', userId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('updateUserState error', e);
    return false;
  }
}

async function sendManyChatReply(psid, message) {
  try {
    const resp = await fetch('https://api.manychat.com/fb/sender', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MANYCHAT_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subscriber_id: psid,
        data: {
          version: 'v2',
          content: { messages: [{ type: 'text', text: message }] }
        }
      })
    });
    if (!resp.ok) throw new Error(`ManyChat status ${resp.status}`);
    return true;
  } catch (e) {
    console.error('sendManyChatReply error', e);
    return false;
  }
}

// --- (Other helper / selection functions remain unchanged for brevity) ---

// Assume the rest of previously provided helper functions are still here:
// - findOrCreateUser
// - getUserSubjectPreferences
// - getActiveSubjects
// - selectAdaptiveSubject
// - selectAdaptiveHook
// - selectAdaptiveQuestion
// - all other handler functions (consent, subject selection, time preference, idle, hook_sent, question_sent, additional_question_sent)

// ============================================================================
// FIXED FUNCTION: handleAnsweredQuestion (changed const -> let + safer flow)
// ============================================================================

async function handleAnsweredQuestion(user, message, psid) {
  const input = normalizeUserInput(message);

  if (input === 'MORE') {
    await logEvent('SESSION_EXTENDED', user.id, { questions_so_far: user.session_question_count });

    // Pick target difficulty
    let targetDifficulty = 'medium';
    if (user.correct_answer_rate >= 0.75) targetDifficulty = 'hard';
    else if (user.correct_answer_rate < 0.55) targetDifficulty = 'easy';

    // Use let so we can reassign if we need to switch subject
    let question = await selectAdaptiveQuestion(user.id, user.current_subject_id, targetDifficulty);

    if (!question) {
      // Try other preferred subjects
      const userPrefs = await getUserSubjectPreferences(user.id);
      let foundQuestion = null;
      let newSubjectId = null;

      for (const pref of userPrefs) {
        if (pref.subject_id !== user.current_subject_id) {
          const candidate = await selectAdaptiveQuestion(
            user.id,
            pref.subject_id,
            targetDifficulty
          );
          if (candidate) {
            foundQuestion = candidate;
            newSubjectId = pref.subject_id;
            break;
          }
        }
      }

      if (!foundQuestion) {
        const response = "Legend! You've crushed all available questions. Tomorrow we go again! 🚀";
        await sendManyChatReply(psid, response);
        await updateUserState(user.id, USER_STATES.SESSION_COMPLETE, {
          daily_session_complete: true
        });
        return;
      }

      // Update subject if changed
      if (newSubjectId) {
        await updateUserState(user.id, USER_STATES.ADDITIONAL_QUESTION_SENT, {
          current_subject_id: newSubjectId
        });
      } else {
        await updateUserState(user.id, USER_STATES.ADDITIONAL_QUESTION_SENT);
      }

      question = foundQuestion;
    } else {
      await updateUserState(user.id, USER_STATES.ADDITIONAL_QUESTION_SENT);
    }

    await updateUserState(user.id, USER_STATES.ADDITIONAL_QUESTION_SENT, {
      current_question_id: question.id,
      question_sent_at: new Date().toISOString()
    });

    await supabase
      .from('mcqs')
      .update({ last_served_at: new Date().toISOString() })
      .eq('id', question.id);

    const response = `Lekker! Here's the next one:\n\n${question.question}\n\nA) ${question.option_a}\nB) ${question.option_b}\nC) ${question.option_c}\nD) ${question.option_d}\n\nReply A, B, C, or D 🎯`;
    await sendManyChatReply(psid, response);

    await logEvent('QUESTION_SERVED', user.id, {
      mcq_id: question.id,
      subject_id: user.current_subject_id,
      topic_id: question.topic_id,
      difficulty: question.difficulty,
      session_position: user.session_question_count + 1
    });
  } else if (input === 'STOP') {
    await updateUserState(user.id, USER_STATES.SESSION_COMPLETE, { daily_session_complete: true });

    await supabase
      .from('daily_sessions')
      .update({
        completed_at: new Date().toISOString(),
        session_duration_minutes: user.hook_sent_at
          ? Math.round((Date.now() - new Date(user.hook_sent_at).getTime()) / 60000)
          : null
      })
      .eq('user_id', user.id)
      .eq('session_date', new Date().toISOString().split('T')[0]);

    const response = getRandomResponse(PERSONA_RESPONSES.COMPLETION);
    await sendManyChatReply(psid, response);

    await logEvent('SESSION_COMPLETED', user.id, {
      total_questions: user.session_question_count,
      session_duration_minutes: user.hook_sent_at
        ? Math.round((Date.now() - new Date(user.hook_sent_at).getTime()) / 60000)
        : null
    });
  } else {
    const response = 'Reply MORE for another question or STOP to finish 🎯🛑';
    await sendManyChatReply(psid, response);
  }
}

// ============================================================================
// MAIN WEBHOOK HANDLER (unchanged except references to included functions)
// ============================================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { psid, text } = req.body;
    if (!psid || !text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // findOrCreateUser should be defined above (omitted here for brevity)
    const user = await findOrCreateUser(psid);
    if (!user) {
      await sendManyChatReply(
        psid,
        "Eish, I'm battling to load your profile. Try again in a bit 🔄"
      );
      return res.status(200).json({ status: 'success' });
    }

    switch (user.current_state) {
      case USER_STATES.CONSENT_PENDING:
        await handleConsentPending(user, text, psid);
        break;
      case USER_STATES.SUBJECT_SELECTION:
        await handleSubjectSelection(user, text, psid);
        break;
      case USER_STATES.TIME_PREFERENCE:
        await handleTimePreference(user, text, psid);
        break;
      case USER_STATES.IDLE:
      case USER_STATES.DECLINED_DAILY:
      case USER_STATES.SESSION_COMPLETE:
        await handleIdleState(user, text, psid);
        break;
      case USER_STATES.HOOK_SENT:
        await handleHookSent(user, text, psid);
        break;
      case USER_STATES.QUESTION_SENT:
        await handleQuestionSent(user, text, psid);
        break;
      case USER_STATES.ANSWERED_QUESTION:
        await handleAnsweredQuestion(user, text, psid);
        break;
      case USER_STATES.ADDITIONAL_QUESTION_SENT:
        await handleAdditionalQuestionSent(user, text, psid);
        break;
      default:
        await updateUserState(user.id, USER_STATES.IDLE);
        await sendManyChatReply(psid, 'Howzit! 🐐 Send START for your daily practice session 👍');
        break;
    }

    return res.status(200).json({ status: 'success' });
  } catch (e) {
    console.error('Webhook error:', e);
    // Attempt soft user message (best effort)
    try {
      await sendManyChatReply(req.body?.psid, 'Eish, something glitched. Try again in a moment 🔄');
    } catch {}
    return res.status(200).json({ status: 'success' }); // Always 200 to prevent retries
  }
}
