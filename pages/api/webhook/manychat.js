/**
 * Advanced Webhook (Fix for: "Question: null" + better 'next' handling)
 *
 * Changes:
 *  - Treat messages 'next', 'new', 'again', 'skip' as a request for a fresh question.
 *  - If user sends 'next' while a question is pending, we clear that question and fetch a new one.
 *  - Defensive: If RPC returns a question with null question_text, we skip it and try a fallback direct SELECT.
 *  - If still no usable question, we inform the user instead of showing "Question: null".
 *  - Local echo preserved (LOCAL_ECHO=true).
 */

import { createClient } from '@supabase/supabase-js';

// ====== ENV ======
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  MANYCHAT_API_TOKEN,
  MANYCHAT_API_BASE = 'https://api.manychat.com/fb',
  EMA_ALPHA = '0.2',
  DIFF_EASY_MAX = '0.38',
  DIFF_MED_MAX = '0.72',
  DIFF_HYSTERESIS = '0.03',
  ANSWER_STALE_MINUTES = '30',
  DEFAULT_TOPIC,
  TOPIC_PROMPT_RETRY_LIMIT = '2',
  RATE_LIMIT_WINDOW_SEC = '10',
  RATE_LIMIT_MAX = '8',
  DEDUP_WINDOW_SEC = '20',
  LOCAL_ECHO
} = process.env;

const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '', {
  auth: { persistSession: false }
});

let lastMessageSent = null;

// ====== TOPICS ======
const TOPIC_ALIASES = {
  algebra: ['algebra', 'alg'],
  trig: ['trig', 'trigonometry'],
  geometry: ['geometry', 'geo']
};
function normalizeTopic(input) {
  if (!input) return null;
  const cleaned = input.trim().toLowerCase();
  for (const c of Object.keys(TOPIC_ALIASES)) {
    if (c === cleaned) return c;
    if (TOPIC_ALIASES[c].includes(cleaned)) return c;
  }
  return null;
}
function listTopics() {
  return Object.keys(TOPIC_ALIASES);
}
function topicPrompt() {
  return `Howzit! Pick a topic to grind: ${listTopics()
    .map((t) => titleCase(t))
    .join(', ')}. Reply with one.`;
}
function titleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ====== RATE / DIFFICULTY ======
function clamp(n, min = 0, max = 1) {
  return Math.min(max, Math.max(min, n));
}
function updateRate(oldRate, isCorrect) {
  const alpha = Number(EMA_ALPHA);
  const next = alpha * (isCorrect ? 1 : 0) + (1 - alpha) * oldRate;
  return Math.round(clamp(next) * 1000) / 1000;
}
function selectDifficulty(rate, previousDifficulty) {
  const easyMax = Number(DIFF_EASY_MAX);
  const medMax = Number(DIFF_MED_MAX);
  const hysteresis = Number(DIFF_HYSTERESIS);
  let target;
  if (rate < easyMax) target = 'easy';
  else if (rate <= medMax) target = 'medium';
  else target = 'hard';
  if (previousDifficulty && previousDifficulty !== target) {
    if (previousDifficulty === 'easy' && rate < easyMax + hysteresis) target = 'easy';
    else if (previousDifficulty === 'hard' && rate > medMax - hysteresis) target = 'hard';
    else if (previousDifficulty === 'medium') {
      if (rate >= easyMax - hysteresis && rate <= medMax + hysteresis) target = 'medium';
    }
  }
  return target;
}
function normalizeChoice(raw) {
  if (!raw) return null;
  const c = raw.trim().toUpperCase().charAt(0);
  if (['A', 'B', 'C', 'D'].includes(c)) return c;
  return null;
}
function isStale(servedAt) {
  if (!servedAt) return true;
  const mins = Number(ANSWER_STALE_MINUTES);
  const cutoff = Date.now() - mins * 60 * 1000;
  return new Date(servedAt).getTime() < cutoff;
}

// ====== LIMITING / DEDUP ======
const rateBuckets = new Map();
const dedupCache = new Map();
const topicRetryMap = new Map();
function rateLimit(psid) {
  const windowMs = Number(RATE_LIMIT_WINDOW_SEC) * 1000;
  const max = Number(RATE_LIMIT_MAX);
  const now = Date.now();
  let b = rateBuckets.get(psid);
  if (!b || b.expires < now) b = { count: 0, expires: now + windowMs };
  b.count += 1;
  rateBuckets.set(psid, b);
  return b.count > max;
}
function dedup(psid, message) {
  const ttl = Number(DEDUP_WINDOW_SEC) * 1000;
  const key = psid + '|' + hash(message.trim().toLowerCase());
  const now = Date.now();
  if (dedupCache.has(key) && dedupCache.get(key) > now) return true;
  dedupCache.set(key, now + ttl);
  return false;
}
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return h.toString(36);
}
function incTopicRetry(psid) {
  topicRetryMap.set(psid, (topicRetryMap.get(psid) || 0) + 1);
}
function getTopicRetry(psid) {
  return topicRetryMap.get(psid) || 0;
}



// ====== MANYCHAT SENDER ======
async function sendReply(psid, text) {
  lastMessageSent = text;
  console.log('[OUTGOING]', text.replace(/\n/g, ' / '));
  if (!MANYCHAT_API_TOKEN) return;
  try {
    const r = await fetch(`${MANYCHAT_API_BASE}/sending/sendContent`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MANYCHAT_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subscriber_id: psid,
        data: {
          version: 'v2',
          content: {
            messages: [{ type: 'text', text }]
          }
        },
        message_tag: 'CONFIRMED_EVENT_UPDATE'
      })
    });
    if (!r.ok) {
      const errorText = await r.text();
      console.error('ManyChat HTTP status', r.status, errorText);
    }
  } catch (e) {
    console.error('ManyChat send error', e.message);
  }
}

// ====== DB HELPERS ======
async function findOrCreateUser(psid) {
  const { data, error } = await supabase
    .from('users')
    .upsert(
      { whatsapp_psid: psid, last_active_at: new Date().toISOString() },
      { onConflict: 'whatsapp_psid' }
    )
    .select(
      'id, current_question_id, current_question_served_at, current_topic, correct_answer_rate, streak_count'
    )
    .single();
  if (error) throw new Error('User upsert failed: ' + error.message);
  return data;
}
async function updateUser(id, fields) {
  const { error } = await supabase
    .from('users')
    .update({ ...fields, last_active_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('User update error', error.message);
}
async function fetchMcqById(id) {
  const { data, error } = await supabase.from('mcqs').select('*').eq('id', id).single();
  if (error) return null;
  return data;
}
async function rpcNextMcq({ difficulty, userId, topic }) {
  const { data, error } = await supabase.rpc('next_mcq', {
    p_difficulty: difficulty,
    p_user_id: userId,
    p_topic: topic || null
  });
  if (error) {
    console.error('next_mcq error', error.message);
    return null;
  }
  return data;
}
async function fallbackSelect({ difficulty, topic }) {
  const { data, error } = await supabase
    .from('mcqs')
    .select('id, question_text, choices, correct_choice, last_served_at, topic, difficulty')
    .eq('difficulty', difficulty)
    .eq('topic', topic)
    .order('last_served_at', { ascending: true, nullsFirst: true })
    .limit(1);
  if (error) {
    console.error('fallbackSelect error', error.message);
    return null;
  }
  return data?.[0] || null;
}
async function logAnswer({ userId, mcq, choice, isCorrect, weaknessTag }) {
  const { error } = await supabase.from('user_answers').insert({
    user_id: userId,
    mcq_id: mcq.id,
    chosen_choice: choice,
    is_correct: isCorrect,
    weakness_tag: weaknessTag || null
  });
  if (error) console.error('user_answers insert error', error.message);

  if (!isCorrect && weaknessTag) {
    const { error: wErr } = await supabase.from('user_weaknesses').insert({
      user_id: userId,
      mcq_id: mcq.id,
      weakness_tag: weaknessTag
    });
    if (wErr) console.error('user_weaknesses insert error', wErr.message);
  }
}

// ====== FORMAT QUESTION ======
function formatQuestion(mcq) {
  if (!mcq || !mcq.question_text) {
    return { text: null, choicesObj: {} };
  }
  let choicesObj = {};
  try {
    choicesObj = typeof mcq.choices === 'string' ? JSON.parse(mcq.choices) : mcq.choices || {};
  } catch {
    choicesObj = {};
  }
  const lines = [];
  lines.push('Question: ' + mcq.question_text);
  lines.push('');
  ['A', 'B', 'C', 'D'].forEach((l) => {
    if (choicesObj[l]) lines.push(`${l}) ${choicesObj[l].text}`);
  });
  lines.push('');
  lines.push('Reply with A, B, C, or D.');
  return { text: lines.join('\n'), choicesObj };
}

// ====== HANDLER ======
export default async function handler(req, res) {
  lastMessageSent = null;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const psid = req.body?.psid;
  const messageRaw = req.body?.message;
  if (!psid || typeof psid !== 'string' || !messageRaw || typeof messageRaw !== 'string') {
    return res.status(400).json({ error: 'Invalid body (psid, message required)' });
  }

  if (dedup(psid, messageRaw)) {
    return res
      .status(200)
      .json({ status: 'success', dedup: true, echo: LOCAL_ECHO ? 'dedup' : undefined });
  }
  if (rateLimit(psid)) {
    await sendReply(psid, 'Yebo, slow down a touch. I’ve got you 💪');
    return res
      .status(200)
      .json({
        status: 'success',
        rate_limited: true,
        echo: LOCAL_ECHO ? lastMessageSent : undefined
      });
  }

  let replied = false;

  try {
    let user = await findOrCreateUser(psid);
    const incoming = messageRaw.trim();
    const lower = incoming.toLowerCase();

    // Recognize commands for a fresh question
    const isNextCommand = ['next', 'new', 'again', 'skip'].includes(lower);

    const wantsTopicChange = ['change topic', 'topic', 'topics'].some((cmd) =>
      lower.startsWith(cmd)
    );

    // If no topic but leftover question -> clear
    if (!user.current_topic && user.current_question_id) {
      await updateUser(user.id, { current_question_id: null, current_question_served_at: null });
      user.current_question_id = null;
    }

    if (wantsTopicChange) {
      await updateUser(user.id, { current_topic: null });
      user.current_topic = null;
    }

    // Topic selection first
    if (!user.current_topic) {
      const maybe = normalizeTopic(incoming);
      if (maybe) {
        await updateUser(user.id, { current_topic: maybe });
        user.current_topic = maybe;
        await sendReply(psid, `Lekker choice! Rolling with ${titleCase(maybe)}. Let’s go!`);
        replied = true;
      } else {
        incTopicRetry(psid);
        const retries = getTopicRetry(psid);
        if (DEFAULT_TOPIC && retries > Number(TOPIC_PROMPT_RETRY_LIMIT)) {
          await updateUser(user.id, { current_topic: DEFAULT_TOPIC });
          user.current_topic = DEFAULT_TOPIC;
          await sendReply(
            psid,
            `Cool, I’ll start you off with ${titleCase(DEFAULT_TOPIC)}. Let’s dive in!`
          );
          replied = true;
        } else if (!replied) {
          await sendReply(psid, topicPrompt());
          replied = true;
          return res
            .status(200)
            .json({ status: 'success', echo: LOCAL_ECHO ? lastMessageSent : undefined });
        }
      }
    }

    // If user wants a new question explicitly, clear current question (skip)
    if (isNextCommand && user.current_question_id) {
      await updateUser(user.id, { current_question_id: null, current_question_served_at: null });
      user.current_question_id = null;
    }

    // ANSWER branch only if topic + a current question + not a next command
    if (user.current_topic && user.current_question_id && !isNextCommand) {
      if (isStale(user.current_question_served_at)) {
        await updateUser(user.id, { current_question_id: null, current_question_served_at: null });
        user.current_question_id = null;
      } else {
        const mcq = await fetchMcqById(user.current_question_id);
        if (!mcq || !mcq.question_text) {
          // Clear unusable question
          await updateUser(user.id, {
            current_question_id: null,
            current_question_served_at: null
          });
          await sendReply(psid, 'Eish, that question glitched. Grabbing a fresh one.');
          // Continue to new question flow
        } else {
          const { choicesObj } = formatQuestion(mcq);
          const choice = normalizeChoice(incoming);
          if (!choice) {
            await sendReply(psid, 'Aweh, just send A, B, C, or D.');
            return res
              .status(200)
              .json({ status: 'success', echo: LOCAL_ECHO ? lastMessageSent : undefined });
          }
          const isCorrect = choice === mcq.correct_choice;
          const weaknessTag =
            !isCorrect && choicesObj[choice] ? choicesObj[choice].weakness_tag : null;
          const newRate = updateRate(user.correct_answer_rate, isCorrect);
          const newStreak = isCorrect ? user.streak_count + 1 : 0;

          await logAnswer({ userId: user.id, mcq, choice, isCorrect, weaknessTag });

          await updateUser(user.id, {
            current_question_id: null,
            current_question_served_at: null,
            correct_answer_rate: newRate,
            streak_count: newStreak
          });

          let feedback;
          if (isCorrect) {
            feedback = '💯 You nailed it! Keep that streak smoking, sharp shooter.';
          } else if (weaknessTag) {
            feedback = `Aweh, close. That’s a classic slip-up with ${weaknessTag}. Lock it in for next time!`;
          } else {
            feedback = 'Not quite. Shake it off—next one you’ll crush.';
          }
          await sendReply(psid, feedback);
          return res
            .status(200)
            .json({ status: 'success', echo: LOCAL_ECHO ? lastMessageSent : undefined });
        }
      }
    }

    // NEW QUESTION FLOW
    const difficulty = selectDifficulty(user.correct_answer_rate, null);

    // Try RPC first
    let mcq = await rpcNextMcq({
      difficulty,
      userId: user.id,
      topic: user.current_topic
    });

    // Defensive: if mcq exists but has null question_text, try fallback
    if (mcq && !mcq.question_text) {
      console.warn('RPC returned MCQ with null question_text; trying fallback SELECT');
      mcq = await fallbackSelect({ difficulty, topic: user.current_topic });
    }

    // If no mcq from RPC and fallback, try fallback directly anyway
    if (!mcq) {
      mcq = await fallbackSelect({ difficulty, topic: user.current_topic });
    }

    // Fallback to DEFAULT_TOPIC only if we have one and current topic differs
    if (!mcq && DEFAULT_TOPIC && user.current_topic !== DEFAULT_TOPIC) {
      const originalTopic = user.current_topic;
      await updateUser(user.id, { current_topic: DEFAULT_TOPIC });
      user.current_topic = DEFAULT_TOPIC;
      mcq = await rpcNextMcq({
        difficulty,
        userId: user.id,
        topic: DEFAULT_TOPIC
      });
      if (mcq && !mcq.question_text) {
        mcq = await fallbackSelect({ difficulty, topic: DEFAULT_TOPIC });
      }
      if (mcq) {
        await sendReply(
          psid,
          `Still loading more for ${titleCase(originalTopic)}. Switched you to ${titleCase(
            DEFAULT_TOPIC
          )} for now.`
        );
      }
    }

    if (!mcq || !mcq.question_text) {
      await sendReply(psid, 'Shot for grinding! I’m cooking fresh questions. Pull in a bit later.');
      return res
        .status(200)
        .json({ status: 'success', echo: LOCAL_ECHO ? lastMessageSent : undefined });
    }

    const { text: questionText } = formatQuestion(mcq);

    await updateUser(user.id, {
      current_question_id: mcq.id,
      current_question_served_at: new Date().toISOString()
    });

    const intro =
      isNextCommand || !lastMessageSent?.startsWith('Lekker choice!')
        ? `Let’s test those skills in ${titleCase(user.current_topic)}.\n\n${questionText}`
        : questionText;

    await sendReply(psid, intro);

    return res
      .status(200)
      .json({ status: 'success', echo: LOCAL_ECHO ? lastMessageSent : undefined });
  } catch (err) {
    console.error('Webhook error', err);
    if (!lastMessageSent) {
      try {
        await sendReply(psid, 'Eish, something glitched. Try again in a moment.');
      } catch {}
    }
    return res
      .status(200)
      .json({ status: 'success', error: true, echo: LOCAL_ECHO ? lastMessageSent : undefined });
  }
}
