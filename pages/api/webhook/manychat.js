/**
 * The GOAT - ManyChat Webhook (WhatsApp channel)
 * Architecture: ManyChat (External Request) -> This API Route -> Supabase
 *
 * WA (WhatsApp) ManyChat API base: https://api.manychat.com
 * Correct send endpoint (v2 content): POST https://api.manychat.com/wa/sending/sendContent
 *
 * Expected inbound JSON body from ManyChat External Request block:
 * {
 *   "subscriber_id": "{{user.id}}",       // ManyChat internal numeric user id (WhatsApp)
 *   "message": "{{last_input}}"           // User's raw message text
 * }
 *
 * For backward compatibility we also accept { psid, message }.
 *
 * Business Rules (from PRD + Implementation Spec):
 *  - If user.current_question_id exists -> treat incoming message as an answer attempt.
 *  - Else -> serve a new question matched to difficulty derived from correct_answer_rate.
 *  - Difficulty mapping: rate < 0.5 => easy, 0.5–<0.8 => medium, >=0.8 => hard.
 *  - correct_answer_rate updated via weighted EMA: new = (old*4 + (isCorrect?1:0)) / 5
 *  - Streak increments on correct; resets on incorrect.
 *  - On incorrect: log weakness_tag (from chosen distractor) into user_weaknesses table.
 *  - Always update last_served_at for the MCQ served.
 *  - Always end with res.status(200).json({status:'success'}) so ManyChat does not retry
 *    (EXCEPT explicit 400 for missing required fields as per spec).
 *
 * Persona / Tone: South African youth slang, encouraging, sharp, authentic.
 */

import { createClient } from '@supabase/supabase-js';

// ---------- Environment Helpers ----------
function reqEnv(name, fallback = undefined) {
  const v = process.env[name];
  if (!v && fallback === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v || fallback;
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url)
    throw new Error('Supabase URL env (SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL) is missing.');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY env is missing.');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' }
  });
}

// ---------- Difficulty & Rate Helpers ----------
function pickDifficulty(rate) {
  if (rate >= 0.8) return 'hard';
  if (rate >= 0.5) return 'medium';
  return 'easy';
}

function updateRate(oldRate, isCorrect) {
  // EMA style weighting 4:1
  return (oldRate * 4 + (isCorrect ? 1 : 0)) / 5;
}

function parseChoices(raw) {
  if (!raw) return [];
  try {
    const j = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

function formatQuestion(q) {
  const choices = parseChoices(q.choices);
  let txt = `🎯 ${capitalize(q.topic || 'Math')} Question:\n\n${q.question_text}\n\n`;
  choices.forEach((c, idx) => {
    const letter = (c.choice || String.fromCharCode(65 + idx)).toUpperCase();
    txt += `${letter}) ${c.text}\n`;
  });
  txt += `\nJust send the letter (A, B, C or D). Sharp? 🔥`;
  return txt;
}

function capitalize(s = '') {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// FIXED: Using WhatsApp endpoint with correct WhatsApp message tags
async function sendManyChatReply(psid, message) {
  try {
    console.log(`🔄 Sending to ManyChat PSID: ${psid}`);
    console.log(`📝 Message: ${message}`);
    const token = process.env.MANYCHAT_API_TOKEN;
    if (!token) {
      console.error('❌ FATAL: MANYCHAT_API_TOKEN is not set!');
      return false;
    }

    // Correct WhatsApp endpoint
    const url = 'https://api.manychat.com/wa/sending/sendContent';

    // Try different WhatsApp message tags in order of preference
    const messageTags = ['UTILITY_UPDATE', 'ACCOUNT_UPDATE', 'PAYMENT_UPDATE'];

    for (const tag of messageTags) {
      const success = await tryMessageTag(url, token, psid, message, tag);
      if (success) return true;
    }

    // If all tags fail, try without tag (for recent conversations)
    console.log('🔄 All tags failed, trying without tag (recent conversation)');
    return await sendWithoutTag(url, token, psid, message);
  } catch (error) {
    console.error('❌ Exception in sendManyChatReply:', error);
    return false;
  }
}

async function tryMessageTag(url, token, psid, message, tag) {
  try {
    const payload = {
      subscriber_id: psid,
      message_tag: tag,
      data: {
        version: 'v2',
        content: {
          messages: [
            {
              type: 'text',
              text: message
            }
          ]
        }
      }
    };

    console.log(`🔄 Attempting WA send with ${tag} tag`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const responseData = await response.json();
      console.log(`✅ Message sent successfully with ${tag}:`, responseData);
      return true;
    }

    const errorText = await response.text();
    console.log(`❌ ${tag} failed: ${errorText}`);
    return false;
  } catch (error) {
    console.error(`❌ Exception trying ${tag}:`, error);
    return false;
  }
}

async function sendWithoutTag(url, token, psid, message) {
  try {
    const payload = {
      subscriber_id: psid,
      data: {
        version: 'v2',
        content: {
          messages: [
            {
              type: 'text',
              text: message
            }
          ]
        }
      }
    };

    console.log(`🔄 Attempting WA send without tag (recent conversation)`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const responseData = await response.json();
      console.log(`✅ Message sent successfully without tag:`, responseData);
      return true;
    }

    const errorText = await response.text();
    console.error(`❌ Send without tag failed: ${errorText}`);
    return false;
  } catch (error) {
    console.error(`❌ Exception sending without tag:`, error);
    return false;
  }
}

// ---------- User & Question Logic ----------
async function findOrCreateUser(supabase, subscriberId) {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, whatsapp_psid, current_question_id, correct_answer_rate, streak_count')
    .eq('whatsapp_psid', subscriberId)
    .maybeSingle();

  if (error) throw new Error(`User fetch error: ${error.message}`);

  if (user) return user;

  const { data: newUser, error: insertErr } = await supabase
    .from('users')
    .insert({
      whatsapp_psid: subscriberId,
      current_question_id: null,
      correct_answer_rate: 0.5,
      streak_count: 0,
      last_active_at: new Date().toISOString()
    })
    .select('id, whatsapp_psid, current_question_id, correct_answer_rate, streak_count')
    .single();

  if (insertErr) throw new Error(`User insert error: ${insertErr.message}`);
  return newUser;
}

async function fetchQuestionById(supabase, id) {
  const { data, error } = await supabase.from('mcqs').select('*').eq('id', id).single();
  if (error) return { question: null, error };
  return { question: data };
}

async function fetchNextQuestion(supabase, difficulty) {
  const { data, error } = await supabase
    .from('mcqs')
    .select('*')
    .eq('difficulty', difficulty)
    .order('last_served_at', { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle();
  if (error) return { question: null, error };
  return { question: data };
}

// ---------- Main Handler ----------
export default async function handler(req, res) {
  const start = Date.now();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', allowed: ['POST'] });
  }

  // Accept both subscriber_id (WhatsApp) and psid (legacy)
  const subscriberId = req.body.subscriber_id || req.body.psid;
  const message = req.body.message;

  if (!subscriberId || !message) {
    // Spec says 400 if missing
    return res.status(400).json({ error: 'Missing subscriber_id/psid or message' });
  }

  // ManyChat WA subscriber_id should be numeric, but we won't hard-fail if not:
  if (!/^\d+$/.test(String(subscriberId))) {
    console.warn('Non-numeric subscriberId (WA expected numeric):', subscriberId);
  }

  let reply = '';
  let replySent = false;

  try {
    const supabase = getSupabaseClient();
    const user = await findOrCreateUser(supabase, subscriberId);

    if (user.current_question_id) {
      // User answering a question
      const { question, error: qErr } = await fetchQuestionById(supabase, user.current_question_id);
      if (qErr || !question) {
        reply = `Eish, that question vanished. Let's reset. Send "next" to get a fresh one. 🔄`;
        await supabase
          .from('users')
          .update({
            current_question_id: null,
            last_active_at: new Date().toISOString()
          })
          .eq('id', user.id);
      } else {
        const userAns = message.trim().toUpperCase();
        const correct = (question.correct_choice || '').trim().toUpperCase();
        const isCorrect = userAns === correct;

        let newStreak = user.streak_count || 0;
        let newRate = updateRate(user.correct_answer_rate ?? 0.5, isCorrect);

        if (isCorrect) {
          newStreak += 1;
          const vibe = newStreak >= 5 ? '🔥🔥🔥' : newStreak >= 3 ? '🔥🔥' : '🔥';
          reply = `💯 Howzit sharp shooter! You nailed it.\nStreak: ${newStreak} ${vibe}\n\nType "next" for another one.`;
        } else {
          newStreak = 0;
          const choices = parseChoices(question.choices);
          const chosen = choices.find(
            (c) =>
              (c.choice && c.choice.toUpperCase() === userAns) ||
              (!c.choice && userAns === String.fromCharCode(65 + choices.indexOf(c)))
          );
          const weaknessTag = chosen?.weakness_tag || 'that concept';

          // Log weakness (removed logged_at column)
          if (weaknessTag) {
            const { error: weakErr } = await supabase.from('user_weaknesses').insert({
              user_id: user.id,
              weakness_tag: weaknessTag
            });
            if (weakErr) {
              console.error('Weakness log error:', weakErr.message);
            }
          }

          reply = `Aweh, not this time. Correct answer was ${correct}. No stress - classic slip in ${weaknessTag}. 💪\n\nType "next" to bounce back.`;
        }

        // Update user stats
        const { error: userUpdErr } = await supabase
          .from('users')
          .update({
            current_question_id: null,
            correct_answer_rate: newRate,
            streak_count: newStreak,
            last_active_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (userUpdErr) {
          console.error('User stats update error:', userUpdErr.message);
        }
      }
    } else {
      // Serve new question
      const rate = user.correct_answer_rate ?? 0.5;
      const diff = pickDifficulty(rate);

      const { question, error: fetchErr } = await fetchNextQuestion(supabase, diff);
      if (fetchErr) {
        console.error('Fetch next question error:', fetchErr.message);
        reply = `Eish, struggling to fetch a question right now. Try again in a bit. 🔄`;
      } else if (!question) {
        reply = `You've smashed all the ${diff} questions I've got right now. Pull through later for fresh heat. 🔥`;
      } else {
        reply = formatQuestion(question);

        // Update user to hold current question & tag question served
        const nowIso = new Date().toISOString();
        const ups = await Promise.all([
          supabase
            .from('users')
            .update({
              current_question_id: question.id,
              last_active_at: nowIso
            })
            .eq('id', user.id),
          supabase.from('mcqs').update({ last_served_at: nowIso }).eq('id', question.id)
        ]);

        ups.forEach((r, idx) => {
          if (r.error) {
            console.error(`Post-serve update error (step ${idx})`, r.error.message);
          }
        });
      }
    }

    await sendManyChatReply(subscriberId, reply);
    replySent = true;
  } catch (err) {
    console.error('Webhook processing error:', {
      message: err.message,
      stack: err.stack
    });

    if (!replySent) {
      try {
        await sendManyChatReply(
          subscriberId,
          `Eish, something glitched on my side. Give it a sec then try "next" again. 🙏`
        );
      } catch (inner) {
        console.error('Failed to send fallback reply:', inner.message);
      }
    }
  } finally {
    // Always 200 to prevent ManyChat automatic retries (unless earlier 400 for validation)
    res.status(200).json({
      status: 'success',
      elapsed_ms: Date.now() - start
    });
  }
}
