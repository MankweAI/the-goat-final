// Multi-Subject Proactive Flow Webhook for The GOAT
// Date: 2025-08-13 09:49:53 UTC
// Author: mankwemokgabudi

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// ============================================================================
// CONSTANTS & CONFIGURATIONS
// ============================================================================

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

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function normalizeUserInput(message) {
  if (!message) return '';
  const cleaned = message.trim().toLowerCase();

  // Check for answer patterns (A, B, C, D)
  if (INPUT_PATTERNS.ANSWER.test(cleaned)) {
    return cleaned.charAt(0).toUpperCase();
  }

  // Check for specific response types
  if (INPUT_PATTERNS.YES.test(cleaned)) return 'YES';
  if (INPUT_PATTERNS.NO.test(cleaned)) return 'NO';
  if (INPUT_PATTERNS.MORE.test(cleaned)) return 'MORE';
  if (INPUT_PATTERNS.STOP.test(cleaned)) return 'STOP';
  if (INPUT_PATTERNS.START.test(cleaned)) return 'START';
  if (INPUT_PATTERNS.TIME.test(cleaned)) return 'TIME';

  return cleaned;
}

function getRandomResponse(responseArray) {
  return responseArray[Math.floor(Math.random() * responseArray.length)];
}

async function logEvent(eventType, userId, metadata = {}) {
  try {
    await supabase.from('events').insert({
      user_id: userId,
      event_type: eventType,
      metadata: metadata
    });
  } catch (error) {
    console.error('Error logging event:', error);
  }
}

async function updateUserState(userId, newState, updates = {}) {
  try {
    const updateData = {
      current_state: newState,
      last_active_at: new Date().toISOString(),
      ...updates
    };

    const { error } = await supabase.from('users').update(updateData).eq('id', userId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating user state:', error);
    return false;
  }
}

async function sendManyChatReply(psid, message) {
  try {
    const response = await fetch('https://api.manychat.com/fb/sender', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MANYCHAT_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subscriber_id: psid,
        data: {
          version: 'v2',
          content: {
            messages: [{ type: 'text', text: message }]
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`ManyChat API error: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('Error sending ManyChat reply:', error);
    return false;
  }
}

// ============================================================================
// USER MANAGEMENT FUNCTIONS
// ============================================================================

async function findOrCreateUser(psid) {
  try {
    // Try to find existing user
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('whatsapp_psid', psid)
      .single();

    if (existingUser) {
      return existingUser;
    }

    // Create new user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        whatsapp_psid: psid,
        current_state: USER_STATES.CONSENT_PENDING,
        consented_daily: false,
        preferred_send_hour: 16,
        timezone_offset_minutes: 120, // SAST default
        streak_count: 0,
        correct_answer_rate: 0.0,
        daily_session_complete: false
      })
      .select()
      .single();

    if (error) throw error;

    await logEvent('USER_CREATED', newUser.id, { psid });
    return newUser;
  } catch (error) {
    console.error('Error finding/creating user:', error);
    return null;
  }
}

async function getUserSubjectPreferences(userId) {
  try {
    const { data, error } = await supabase
      .from('user_subject_preferences')
      .select(
        `
        *,
        subjects:subject_id (
          id, name, display_name, icon_emoji
        )
      `
      )
      .eq('user_id', userId)
      .eq('is_enabled', true)
      .order('priority_order');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting user subject preferences:', error);
    return [];
  }
}

async function getActiveSubjects() {
  try {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting active subjects:', error);
    return [];
  }
}

// ============================================================================
// CONTENT SELECTION FUNCTIONS
// ============================================================================

async function selectAdaptiveSubject(userId) {
  try {
    const userPrefs = await getUserSubjectPreferences(userId);

    if (userPrefs.length === 0) {
      // No preferences set, return first active subject
      const subjects = await getActiveSubjects();
      return subjects[0] || null;
    }

    // Get user's recent answer data for weakness analysis
    const { data: recentAnswers } = await supabase
      .from('events')
      .select('metadata')
      .eq('user_id', userId)
      .eq('event_type', 'ANSWER_SUBMITTED')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    // Analyze weaknesses by subject
    const subjectStats = {};
    recentAnswers?.forEach((answer) => {
      const subjectId = answer.metadata?.subject_id;
      const correct = answer.metadata?.correct;

      if (subjectId) {
        if (!subjectStats[subjectId]) {
          subjectStats[subjectId] = { total: 0, correct: 0 };
        }
        subjectStats[subjectId].total++;
        if (correct) subjectStats[subjectId].correct++;
      }
    });

    // Find weakest subject from user preferences
    let weakestSubject = null;
    let lowestRate = 1.0;

    for (const pref of userPrefs) {
      const subjectId = pref.subject_id;
      const stats = subjectStats[subjectId];

      if (stats && stats.total >= 3) {
        const rate = stats.correct / stats.total;
        if (rate < lowestRate) {
          lowestRate = rate;
          weakestSubject = pref.subjects;
        }
      }
    }

    // Return weakest subject or first preference
    return weakestSubject || userPrefs[0].subjects;
  } catch (error) {
    console.error('Error selecting adaptive subject:', error);
    const subjects = await getActiveSubjects();
    return subjects[0] || null;
  }
}

async function selectAdaptiveHook(userId, subjectId) {
  try {
    // Get user's recent hook topics to avoid repetition
    const { data: recentHooks } = await supabase
      .from('events')
      .select('metadata')
      .eq('user_id', userId)
      .eq('event_type', 'HOOK_SENT')
      .gte('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    const recentTopicIds = recentHooks?.map((h) => h.metadata?.topic_id).filter(Boolean) || [];

    // Find hooks for the subject, preferring unused ones
    const { data: hooks, error } = await supabase
      .from('hooks')
      .select('*')
      .eq('subject_id', subjectId)
      .not('id', 'in', `(${recentTopicIds.join(',') || 'null'})`)
      .order('usage_count')
      .order('last_served_at', { ascending: true, nullsFirst: true })
      .limit(5);

    if (error) throw error;

    if (!hooks || hooks.length === 0) {
      // Fallback: get any hook for this subject
      const { data: fallbackHooks } = await supabase
        .from('hooks')
        .select('*')
        .eq('subject_id', subjectId)
        .order('usage_count')
        .limit(1);

      return fallbackHooks?.[0] || null;
    }

    return hooks[0];
  } catch (error) {
    console.error('Error selecting adaptive hook:', error);
    return null;
  }
}

async function selectAdaptiveQuestion(userId, subjectId, targetDifficulty = 'medium') {
  try {
    // Get user's recent questions to avoid repetition
    const { data: recentQuestions } = await supabase
      .from('events')
      .select('metadata')
      .eq('user_id', userId)
      .eq('event_type', 'QUESTION_SERVED')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    const recentQuestionIds = recentQuestions?.map((q) => q.metadata?.mcq_id).filter(Boolean) || [];

    // Difficulty fallback chain
    const difficultyChain =
      targetDifficulty === 'hard'
        ? ['hard', 'medium', 'easy']
        : targetDifficulty === 'easy'
          ? ['easy', 'medium', 'hard']
          : ['medium', 'easy', 'hard'];

    for (const difficulty of difficultyChain) {
      const { data: questions, error } = await supabase
        .from('mcqs')
        .select('*')
        .eq('subject_id', subjectId)
        .eq('difficulty', difficulty)
        .not('id', 'in', `(${recentQuestionIds.join(',') || 'null'})`)
        .order('last_served_at', { ascending: true, nullsFirst: true })
        .limit(1);

      if (error) throw error;

      if (questions && questions.length > 0) {
        return questions[0];
      }
    }

    // Ultimate fallback: any question from this subject
    const { data: fallbackQuestions } = await supabase
      .from('mcqs')
      .select('*')
      .eq('subject_id', subjectId)
      .order('last_served_at', { ascending: true, nullsFirst: true })
      .limit(1);

    return fallbackQuestions?.[0] || null;
  } catch (error) {
    console.error('Error selecting adaptive question:', error);
    return null;
  }
}

// ============================================================================
// STATE HANDLER FUNCTIONS
// ============================================================================

async function handleConsentPending(user, message, psid) {
  const input = normalizeUserInput(message);

  if (input === 'START' || input === 'YES') {
    // User wants to start - move to subject selection
    await updateUserState(user.id, USER_STATES.SUBJECT_SELECTION);

    const subjects = await getActiveSubjects();
    const subjectList = subjects.map((s) => `${s.icon_emoji} ${s.display_name}`).join('\n');

    const response = `${getRandomResponse(PERSONA_RESPONSES.WELCOME)}

I can help you practice across multiple subjects:

${subjectList}

Which subjects are you keen to practice? Reply with the subject names (e.g., "Mathematics Physics") or reply ALL for everything 📚`;

    await sendManyChatReply(psid, response);
    await logEvent('CONSENT_FLOW_STARTED', user.id);
  } else if (input === 'NO' || input === 'STOP') {
    const response = "No stress! When you're ready to level up your knowledge, just send START 🤙";
    await sendManyChatReply(psid, response);
    await logEvent('CONSENT_DECLINED', user.id);
  } else {
    // Unclear response - re-prompt
    const response = `Howzit! 🐐 I'm The GOAT - your daily practice partner.

Want me to send you one spicy practice question every day? 

Reply YES to get started or NO if you're not keen 👍👎`;

    await sendManyChatReply(psid, response);
  }
}

async function handleSubjectSelection(user, message, psid) {
  const input = normalizeUserInput(message);
  const subjects = await getActiveSubjects();

  let selectedSubjects = [];

  if (input === 'all') {
    selectedSubjects = subjects;
  } else {
    // Parse subject names from message
    for (const subject of subjects) {
      if (
        message.toLowerCase().includes(subject.name.toLowerCase()) ||
        message.toLowerCase().includes(subject.display_name.toLowerCase())
      ) {
        selectedSubjects.push(subject);
      }
    }
  }

  if (selectedSubjects.length === 0) {
    // No valid subjects found
    const subjectList = subjects.map((s) => `${s.icon_emoji} ${s.display_name}`).join('\n');
    const response = `Eish, I didn't catch that. Which subjects would you like to practice?

${subjectList}

Reply with subject names or ALL for everything 📚`;

    await sendManyChatReply(psid, response);
    return;
  }

  // Save user subject preferences
  for (let i = 0; i < selectedSubjects.length; i++) {
    const subject = selectedSubjects[i];
    await supabase.from('user_subject_preferences').insert({
      user_id: user.id,
      subject_id: subject.id,
      is_enabled: true,
      priority_order: i
    });
  }

  await updateUserState(user.id, USER_STATES.TIME_PREFERENCE);

  const selectedNames = selectedSubjects.map((s) => s.display_name).join(', ');
  const response = `Sharp! You selected: ${selectedNames} 🔥

What time should I send your daily practice? Reply with an hour (e.g., 16 for 4PM, 9 for 9AM) ⏰`;

  await sendManyChatReply(psid, response);
  await logEvent('SUBJECTS_SELECTED', user.id, {
    subject_ids: selectedSubjects.map((s) => s.id),
    subject_names: selectedNames
  });
}

async function handleTimePreference(user, message, psid) {
  const input = normalizeUserInput(message);

  if (input === 'TIME') {
    const hour = parseInt(message.trim());

    await updateUserState(user.id, USER_STATES.IDLE, {
      consented_daily: true,
      preferred_send_hour: hour,
      daily_session_complete: false
    });

    // Send first hook immediately
    await handleIdleState(user, 'START', psid, true);

    await logEvent('ONBOARDING_COMPLETED', user.id, {
      preferred_hour: hour,
      immediate_start: true
    });
  } else {
    const response = `Please reply with just the hour number (0-23).

For example:
• 9 for 9 AM
• 16 for 4 PM  
• 20 for 8 PM

What time works for you? ⏰`;

    await sendManyChatReply(psid, response);
  }
}

async function handleIdleState(user, message, psid, forceStart = false) {
  const input = normalizeUserInput(message);

  if (input === 'START' || forceStart) {
    // Send daily hook
    const subject = await selectAdaptiveSubject(user.id);

    if (!subject) {
      const response = 'Eish! No subjects available right now. Contact support 📞';
      await sendManyChatReply(psid, response);
      return;
    }

    const hook = await selectAdaptiveHook(user.id, subject.id);

    if (!hook) {
      const response = 'No fresh content available. Adding more soon! 🔄';
      await sendManyChatReply(psid, response);
      return;
    }

    // Create daily session
    await supabase.from('daily_sessions').insert({
      user_id: user.id,
      session_date: new Date().toISOString().split('T')[0],
      hook_topic: hook.topic,
      hook_accepted: null
    });

    await updateUserState(user.id, USER_STATES.HOOK_SENT, {
      hook_sent_at: new Date().toISOString(),
      current_subject_id: subject.id,
      last_hook_subject_id: subject.id,
      last_hook_topic: hook.topic,
      session_question_count: 0
    });

    // Update hook usage
    await supabase
      .from('hooks')
      .update({
        usage_count: hook.usage_count + 1,
        last_served_at: new Date().toISOString()
      })
      .eq('id', hook.id);

    const response = `${hook.text}

${getRandomResponse(PERSONA_RESPONSES.HOOK_CTAS)}`;

    await sendManyChatReply(psid, response);

    await logEvent('HOOK_SENT', user.id, {
      hook_id: hook.id,
      subject_id: subject.id,
      topic_id: hook.topic_id,
      subject_name: subject.name,
      topic_name: hook.topic
    });
  } else if (input === 'STOP') {
    await updateUserState(user.id, USER_STATES.CONSENT_PENDING, {
      consented_daily: false
    });

    const response = "No worries! When you're ready to continue, just send START 🤙";
    await sendManyChatReply(psid, response);
    await logEvent('USER_OPTED_OUT', user.id);
  } else {
    const response = 'Howzit! 🐐 Send START for your daily practice session or STOP to pause 👍';
    await sendManyChatReply(psid, response);
  }
}

async function handleHookSent(user, message, psid) {
  const input = normalizeUserInput(message);

  if (input === 'YES') {
    // User accepted hook - send question
    await supabase
      .from('daily_sessions')
      .update({ hook_accepted: true })
      .eq('user_id', user.id)
      .eq('session_date', new Date().toISOString().split('T')[0]);

    await logEvent('HOOK_ACCEPTED', user.id);

    // Calculate difficulty based on user's performance
    let targetDifficulty = 'medium';
    if (user.correct_answer_rate >= 0.75) {
      targetDifficulty = 'hard';
    } else if (user.correct_answer_rate < 0.55) {
      targetDifficulty = 'easy';
    }

    const question = await selectAdaptiveQuestion(
      user.id,
      user.current_subject_id,
      targetDifficulty
    );

    if (!question) {
      const response = 'Eish! No questions available for this topic right now. Try again later 🔄';
      await sendManyChatReply(psid, response);
      await updateUserState(user.id, USER_STATES.IDLE);
      return;
    }

    await updateUserState(user.id, USER_STATES.QUESTION_SENT, {
      current_question_id: question.id,
      question_sent_at: new Date().toISOString()
    });

    // Update question usage
    await supabase
      .from('mcqs')
      .update({ last_served_at: new Date().toISOString() })
      .eq('id', question.id);

    const response = `Sharp! Here's your challenge:

**${question.question}**

A) ${question.option_a}
B) ${question.option_b}
C) ${question.option_c}
D) ${question.option_d}

Reply with A, B, C, or D 🎯`;

    await sendManyChatReply(psid, response);

    await logEvent('QUESTION_SERVED', user.id, {
      mcq_id: question.id,
      subject_id: user.current_subject_id,
      topic_id: question.topic_id,
      difficulty: question.difficulty,
      target_difficulty: targetDifficulty
    });
  } else if (input === 'NO') {
    // User declined hook
    await supabase
      .from('daily_sessions')
      .update({ hook_accepted: false })
      .eq('user_id', user.id)
      .eq('session_date', new Date().toISOString().split('T')[0]);

    await updateUserState(user.id, USER_STATES.DECLINED_DAILY, {
      daily_session_complete: true
    });

    const response = getRandomResponse(PERSONA_RESPONSES.DECLINE_RESPONSES);
    await sendManyChatReply(psid, response);

    await logEvent('HOOK_DECLINED', user.id);
  } else {
    const response = "Reply YES if you're keen for the challenge, or NO to skip today 👍👎";
    await sendManyChatReply(psid, response);
  }
}

async function handleQuestionSent(user, message, psid) {
  const input = normalizeUserInput(message);

  if (['A', 'B', 'C', 'D'].includes(input)) {
    // Get the current question
    const { data: question } = await supabase
      .from('mcqs')
      .select('*')
      .eq('id', user.current_question_id)
      .single();

    if (!question) {
      const response = "Eish! Something went wrong. Let's try again 🔄";
      await updateUserState(user.id, USER_STATES.IDLE);
      await sendManyChatReply(psid, response);
      return;
    }

    const correct = input === question.correct_answer;
    const sessionCount = user.session_question_count + 1;

    // Update user stats
    const newTotalQuestions = user.total_questions_answered + 1;
    const newCorrectQuestions = user.total_correct_answers + (correct ? 1 : 0);
    const newCorrectRate = newCorrectQuestions / newTotalQuestions;
    const newStreak = correct ? user.streak_count + 1 : 0;

    await updateUserState(user.id, USER_STATES.ANSWERED_QUESTION, {
      session_question_count: sessionCount,
      total_questions_answered: newTotalQuestions,
      total_correct_answers: newCorrectQuestions,
      correct_answer_rate: newCorrectRate,
      streak_count: newStreak,
      current_question_id: null
    });

    // Update session stats
    await supabase
      .from('daily_sessions')
      .update({
        questions_answered: sessionCount,
        questions_correct: user.session_correct_count + (correct ? 1 : 0)
      })
      .eq('user_id', user.id)
      .eq('session_date', new Date().toISOString().split('T')[0]);

    // Log weakness if incorrect
    if (!correct) {
      await supabase.from('user_weaknesses').insert({
        user_id: user.id,
        subject_id: user.current_subject_id,
        topic_id: question.topic_id,
        mcq_id: question.id,
        weakness_tag: question.topic
      });
    }

    // Prepare feedback response
    let feedback = '';
    if (correct) {
      feedback = `${getRandomResponse(PERSONA_RESPONSES.CORRECT_RESPONSES)}

${question.explanation || 'Nailed it! 💪'}`;
    } else {
      feedback = `${getRandomResponse(PERSONA_RESPONSES.INCORRECT_RESPONSES)} The correct answer was ${question.correct_answer}.

${question.explanation || 'Keep pushing! 💪'}`;
    }

    const moreCTA = getRandomResponse(PERSONA_RESPONSES.MORE_CTAS);
    const response = `${feedback}

${moreCTA}`;

    await sendManyChatReply(psid, response);

    await logEvent('ANSWER_SUBMITTED', user.id, {
      mcq_id: question.id,
      subject_id: user.current_subject_id,
      topic_id: question.topic_id,
      answer_given: input,
      correct_answer: question.correct_answer,
      correct: correct,
      session_position: sessionCount,
      new_streak: newStreak,
      new_accuracy: newCorrectRate
    });
  } else {
    const response = 'Please reply with A, B, C, or D for your answer 🎯';
    await sendManyChatReply(psid, response);
  }
}

async function handleAnsweredQuestion(user, message, psid) {
  const input = normalizeUserInput(message);

  if (input === 'MORE') {
    // User wants another question
    await logEvent('SESSION_EXTENDED', user.id, {
      questions_so_far: user.session_question_count
    });

    // Select next question (potentially different subject)
    let targetDifficulty = 'medium';
    if (user.correct_answer_rate >= 0.75) {
      targetDifficulty = 'hard';
    } else if (user.correct_answer_rate < 0.55) {
      targetDifficulty = 'easy';
    }

    const question = await selectAdaptiveQuestion(
      user.id,
      user.current_subject_id,
      targetDifficulty
    );

    if (!question) {
      // Try other subjects
      const userPrefs = await getUserSubjectPreferences(user.id);
      let foundQuestion = null;

      for (const pref of userPrefs) {
        if (pref.subject_id !== user.current_subject_id) {
          foundQuestion = await selectAdaptiveQuestion(user.id, pref.subject_id, targetDifficulty);
          if (foundQuestion) {
            await updateUserState(user.id, USER_STATES.ADDITIONAL_QUESTION_SENT, {
              current_subject_id: pref.subject_id
            });
            break;
          }
        }
      }

      if (!foundQuestion) {
        const response = `Legend! You've crushed all available questions. Tomorrow we go again! 🚀`;
        await sendManyChatReply(psid, response);
        await updateUserState(user.id, USER_STATES.SESSION_COMPLETE, {
          daily_session_complete: true
        });
        return;
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

    const response = `Lekker! Here's the next one:

**${question.question}**

A) ${question.option_a}
B) ${question.option_b}
C) ${question.option_c}
D) ${question.option_d}

Reply A, B, C, or D 🎯`;

    await sendManyChatReply(psid, response);

    await logEvent('QUESTION_SERVED', user.id, {
      mcq_id: question.id,
      subject_id: user.current_subject_id,
      topic_id: question.topic_id,
      difficulty: question.difficulty,
      session_position: user.session_question_count + 1
    });
  } else if (input === 'STOP') {
    // User wants to end session
    await updateUserState(user.id, USER_STATES.SESSION_COMPLETE, {
      daily_session_complete: true
    });

    // Update session completion
    await supabase
      .from('daily_sessions')
      .update({
        completed_at: new Date().toISOString(),
        session_duration_minutes: Math.round(
          (new Date() - new Date(user.hook_sent_at)) / (1000 * 60)
        )
      })
      .eq('user_id', user.id)
      .eq('session_date', new Date().toISOString().split('T')[0]);

    const response = getRandomResponse(PERSONA_RESPONSES.COMPLETION);
    await sendManyChatReply(psid, response);

    await logEvent('SESSION_COMPLETED', user.id, {
      total_questions: user.session_question_count,
      session_duration_minutes: Math.round((new Date() - new Date(user.hook_sent_at)) / (1000 * 60))
    });
  } else {
    const response = 'Reply MORE for another question or STOP to finish 🎯🛑';
    await sendManyChatReply(psid, response);
  }
}

async function handleAdditionalQuestionSent(user, message, psid) {
  // Same logic as handleQuestionSent, but transitions back to ANSWERED_QUESTION
  const input = normalizeUserInput(message);

  if (['A', 'B', 'C', 'D'].includes(input)) {
    const { data: question } = await supabase
      .from('mcqs')
      .select('*')
      .eq('id', user.current_question_id)
      .single();

    if (!question) {
      const response = "Eish! Something went wrong. Let's try again 🔄";
      await updateUserState(user.id, USER_STATES.IDLE);
      await sendManyChatReply(psid, response);
      return;
    }

    const correct = input === question.correct_answer;
    const sessionCount = user.session_question_count + 1;

    // Update user stats (same as handleQuestionSent)
    const newTotalQuestions = user.total_questions_answered + 1;
    const newCorrectQuestions = user.total_correct_answers + (correct ? 1 : 0);
    const newCorrectRate = newCorrectQuestions / newTotalQuestions;
    const newStreak = correct ? user.streak_count + 1 : 0;

    await updateUserState(user.id, USER_STATES.ANSWERED_QUESTION, {
      session_question_count: sessionCount,
      total_questions_answered: newTotalQuestions,
      total_correct_answers: newCorrectQuestions,
      correct_answer_rate: newCorrectRate,
      streak_count: newStreak,
      current_question_id: null
    });

    // Update session stats
    await supabase
      .from('daily_sessions')
      .update({
        questions_answered: sessionCount,
        questions_correct: user.session_correct_count + (correct ? 1 : 0)
      })
      .eq('user_id', user.id)
      .eq('session_date', new Date().toISOString().split('T')[0]);

    if (!correct) {
      await supabase.from('user_weaknesses').insert({
        user_id: user.id,
        subject_id: user.current_subject_id,
        topic_id: question.topic_id,
        mcq_id: question.id,
        weakness_tag: question.topic
      });
    }

    // Feedback
    let feedback = '';
    if (correct) {
      feedback = `${getRandomResponse(PERSONA_RESPONSES.CORRECT_RESPONSES)}

${question.explanation || 'Nailed it! 💪'}`;
    } else {
      feedback = `${getRandomResponse(PERSONA_RESPONSES.INCORRECT_RESPONSES)} The correct answer was ${question.correct_answer}.

${question.explanation || 'Keep pushing! 💪'}`;
    }

    const moreCTA = getRandomResponse(PERSONA_RESPONSES.MORE_CTAS);
    const response = `${feedback}

${moreCTA}`;

    await sendManyChatReply(psid, response);

    await logEvent('ANSWER_SUBMITTED', user.id, {
      mcq_id: question.id,
      subject_id: user.current_subject_id,
      topic_id: question.topic_id,
      answer_given: input,
      correct_answer: question.correct_answer,
      correct: correct,
      session_position: sessionCount,
      new_streak: newStreak,
      new_accuracy: newCorrectRate
    });
  } else {
    const response = 'Please reply with A, B, C, or D for your answer 🎯';
    await sendManyChatReply(psid, response);
  }
}

// ============================================================================
// MAIN WEBHOOK HANDLER
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

    // Find or create user
    const user = await findOrCreateUser(psid);
    if (!user) {
      return res.status(500).json({ error: 'Failed to find/create user' });
    }

    // Route based on current state
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
        // Unknown state - reset to idle
        await updateUserState(user.id, USER_STATES.IDLE);
        const response = 'Howzit! 🐐 Send START for your daily practice session 👍';
        await sendManyChatReply(psid, response);
        break;
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
