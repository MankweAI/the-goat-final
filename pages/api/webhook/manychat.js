/**
 * The GOAT - ManyChat Webhook (WhatsApp channel)
 * Architecture: ManyChat (External Request) -> This API Route -> Supabase
 *
 * Return and Respond Model:
 * 1. ManyChat sends user input to this webhook
 * 2. Webhook processes logic and generates response
 * 3. Webhook returns JSON with 'echo' field containing the response
 * 4. ManyChat displays the 'echo' content to the user
 *
 * Expected inbound JSON body from ManyChat External Request block:
 * {
 *   "subscriber_id": "{{user.id}}",       // ManyChat internal numeric user id (WhatsApp)
 *   "message": "{{last_input}}"           // User's raw message text
 * }
 *
 * Expected outbound JSON response to ManyChat:
 * {
 *   "status": "success",
 *   "echo": "Bot response text here",
 *   "elapsed_ms": 123
 * }
 *
 * Business Rules (from PRD + Implementation Spec):
 *  - If user.current_question_id exists -> treat incoming message as an answer attempt.
 *  - Else -> serve a new question matched to difficulty derived from correct_answer_rate.
 *  - Difficulty mapping: rate < 0.5 => easy, 0.5–<0.8 => medium, >=0.8 => hard.
 *  - correct_answer_rate updated via weighted EMA: new = (old*4 + (isCorrect?1:0)) / 5
 *  - Streak increments on correct; resets on incorrect.
 *  - On incorrect: log weakness_tag (from chosen distractor) into user_weaknesses table.
 *  - Always update last_served_at for the MCQ served.
 *  - Always end with res.status(200).json() with echo field for ManyChat to display
 *    (EXCEPT explicit 400 for missing required fields as per spec).
 *
 * Persona / Tone: South African youth slang, encouraging, sharp, authentic.
 */

import { createClient } from '@supabase/supabase-js';

// ---------- Environment Helpers ----------
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

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      allowed: ['POST'],
      echo: 'Only POST requests are supported.'
    });
  }

  // Extract subscriber ID and message from request
  const subscriberId = req.body.subscriber_id || req.body.psid;
  const message = req.body.message;

  // Validate required fields
  if (!subscriberId || !message) {
    return res.status(400).json({
      error: 'Missing subscriber_id/psid or message',
      echo: 'Missing required fields. Please contact support.'
    });
  }

  // Log request for debugging
  console.log(`📥 Webhook request from subscriber ${subscriberId}: "${message}"`);

  // Validate WhatsApp subscriber ID format (should be numeric)
  if (!/^\d+$/.test(String(subscriberId))) {
    console.warn(`⚠️  Non-numeric subscriberId (expected numeric for WhatsApp): ${subscriberId}`);
  }

  // Initialize response structure
  let responseData = {
    status: 'success',
    echo: '',
    elapsed_ms: 0,
    subscriber_id: subscriberId,
    processed_at: new Date().toISOString()
  };

  try {
    const supabase = getSupabaseClient();
    const user = await findOrCreateUser(supabase, subscriberId);

    let reply = '';

    if (user.current_question_id) {
      // User is answering a question
      console.log(`🎯 User ${subscriberId} answering question ${user.current_question_id}`);

      const { question, error: qErr } = await fetchQuestionById(supabase, user.current_question_id);

      if (qErr || !question) {
        console.error(`❌ Question ${user.current_question_id} not found:`, qErr?.message);
        reply = `Eish, that question vanished. Let's reset. Send "next" to get a fresh one. 🔄`;

        // Reset user's current question
        await supabase
          .from('users')
          .update({
            current_question_id: null,
            last_active_at: new Date().toISOString()
          })
          .eq('id', user.id);
      } else {
        // Process the user's answer
        const userAns = message.trim().toUpperCase();
        const correct = (question.correct_choice || '').trim().toUpperCase();
        const isCorrect = userAns === correct;

        console.log(`📝 User answer: ${userAns}, Correct: ${correct}, Is Correct: ${isCorrect}`);

        let newStreak = user.streak_count || 0;
        let newRate = updateRate(user.correct_answer_rate ?? 0.5, isCorrect);

        if (isCorrect) {
          // Correct answer
          newStreak += 1;
          const vibe = newStreak >= 5 ? '🔥🔥🔥' : newStreak >= 3 ? '🔥🔥' : '🔥';
          reply = `💯 Howzit sharp shooter! You nailed it.\nStreak: ${newStreak} ${vibe}\n\nType "next" for another one.`;
          console.log(`✅ Correct answer! New streak: ${newStreak}`);
        } else {
          // Incorrect answer
          newStreak = 0;
          const choices = parseChoices(question.choices);
          const chosen = choices.find(
            (c) =>
              (c.choice && c.choice.toUpperCase() === userAns) ||
              (!c.choice && userAns === String.fromCharCode(65 + choices.indexOf(c)))
          );
          const weaknessTag = chosen?.weakness_tag || 'that concept';

          // Log the weakness for analytics
          if (weaknessTag) {
            try {
              await supabase.from('user_weaknesses').insert({
                user_id: user.id,
                mcq_id: question.id,
                weakness_tag: weaknessTag
              });
              console.log(`📊 Logged weakness: ${weaknessTag}`);
            } catch (weakErr) {
              console.error('❌ Weakness log error:', weakErr.message);
            }
          }

          reply = `Aweh, not this time. Correct answer was ${correct}. No stress - classic slip in ${weaknessTag}. 💪\n\nType "next" to bounce back.`;
          console.log(`❌ Incorrect answer. Correct was: ${correct}`);
        }

        // Update user stats
        try {
          await supabase
            .from('users')
            .update({
              current_question_id: null,
              correct_answer_rate: newRate,
              streak_count: newStreak,
              last_active_at: new Date().toISOString()
            })
            .eq('id', user.id);
          console.log(`📈 Updated user stats: rate=${newRate.toFixed(3)}, streak=${newStreak}`);
        } catch (userUpdErr) {
          console.error('❌ User stats update error:', userUpdErr.message);
        }
      }
    } else {
      // User needs a new question
      console.log(`🆕 Serving new question to user ${subscriberId}`);

      const rate = user.correct_answer_rate ?? 0.5;
      const difficulty = pickDifficulty(rate);

      console.log(`🎚️  User rate: ${rate.toFixed(3)}, Selected difficulty: ${difficulty}`);

      const { question, error: fetchErr } = await fetchNextQuestion(supabase, difficulty);

      if (fetchErr) {
        console.error('❌ Fetch next question error:', fetchErr.message);
        reply = `Eish, struggling to fetch a question right now. Try again in a bit. 🔄`;
      } else if (!question) {
        console.log(`📚 No more ${difficulty} questions available`);
        reply = `You've smashed all the ${difficulty} questions I've got right now. Pull through later for fresh heat. 🔥`;
      } else {
        console.log(
          `📖 Serving question ${question.id} (${difficulty}): ${question.question_text?.substring(0, 50)}...`
        );

        reply = formatQuestion(question);

        // Update user to track current question and mark question as served
        const nowIso = new Date().toISOString();
        try {
          await Promise.all([
            supabase
              .from('users')
              .update({
                current_question_id: question.id,
                last_active_at: nowIso
              })
              .eq('id', user.id),
            supabase.from('mcqs').update({ last_served_at: nowIso }).eq('id', question.id)
          ]);
          console.log(`🔄 Set current question ${question.id} for user ${subscriberId}`);
        } catch (updateErr) {
          console.error('❌ Question assignment error:', updateErr.message);
        }
      }
    }

    // Set the response that ManyChat will display to the user
    responseData.echo = reply;
    responseData.elapsed_ms = Date.now() - start;

    console.log(`✅ Webhook processed successfully in ${responseData.elapsed_ms}ms`);
    console.log(`📤 Response: ${reply.substring(0, 100)}${reply.length > 100 ? '...' : ''}`);
  } catch (err) {
    console.error('💥 Webhook processing error:', {
      message: err.message,
      stack: err.stack,
      subscriberId,
      inputMessage: message
    });

    // Even on error, provide a user-friendly response
    responseData.status = 'error';
    responseData.echo = `Eish, something glitched on my side. Give it a sec then try "next" again. 🙏`;
    responseData.elapsed_ms = Date.now() - start;
    responseData.error = err.message;
  }

  // Always return 200 with the response data for ManyChat to process
  return res.status(200).json(responseData);
}
