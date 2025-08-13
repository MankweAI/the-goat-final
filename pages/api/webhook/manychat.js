import { createClient } from '@supabase/supabase-js';

// --------- ENV HELPERS ----------
function env(name) {
  return process.env[name];
}

function getSupabaseClient() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL') || env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url) throw new Error('Supabase URL missing');
  if (!key) throw new Error('Supabase service role key missing');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function getManyChatToken() {
  return env('MANYCHAT_API_TOKEN');
}

// --------- ADAPTIVE HELPERS ----------
function pickDifficulty(rate = 0.5) {
  if (rate >= 0.8) return 'hard';
  if (rate >= 0.5) return 'medium';
  return 'easy';
}
function updateRate(oldRate = 0.5, isCorrect) {
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
  let txt = `🎯 Question:\n\n${q.question_text}\n\n`;
  choices.forEach((c, i) => {
    const letter = c.choice || String.fromCharCode(65 + i);
    txt += `${letter}) ${c.text}\n`;
  });
  txt += `\nReply with just the letter (A, B, C or D). 🔥`;
  return txt;
}

// --------- MANYCHAT SENDER ----------
async function sendManyChatReply({ subscriberId, text }) {
  const token = getManyChatToken();
  if (!token) throw new Error('Missing MANYCHAT_API_TOKEN');
  if (!subscriberId) throw new Error('Missing subscriberId for ManyChat send');

  // WhatsApp endpoint (change to /fb/ if truly using Facebook)
  const url = 'https://api.manychat.com/wa/sending/sendContent';

  const body = {
    subscriber_id: subscriberId,
    data: {
      version: 'v2',
      content: {
        messages: [{ type: 'text', text }]
      }
    }
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const raw = await resp.text();
  if (!resp.ok) {
    console.error('ManyChat send failed', resp.status, raw);
    throw new Error(`ManyChat error ${resp.status}`);
  }
  return raw;
}

// --------- MAIN HANDLER ----------
export default async function handler(req, res) {
  const start = Date.now();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Accept either subscriber_id or psid (legacy)
  const subscriber_id = req.body.subscriber_id || req.body.psid;
  const message = req.body.message;

  // Basic validation (we still return 200 to stop MC retries)
  if (!subscriber_id || !message) {
    console.warn('Bad request body', req.body);
    return res.status(200).json({ status: 'error', error: 'Missing subscriber_id or message' });
  }

  // Strong hint if subscriber_id is not numeric
  if (!/^\d+$/.test(String(subscriber_id))) {
    console.warn(
      'subscriber_id is not numeric. For WhatsApp you must pass {{user.id}} from ManyChat. Received:',
      subscriber_id
    );
  }

  let replyText = '';
  let alreadySent = false;

  try {
    const supabase = getSupabaseClient();

    // Find or create user (single round-trip attempt)
    let { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, whatsapp_psid, current_question_id, correct_answer_rate, streak_count')
      .eq('whatsapp_psid', subscriber_id)
      .maybeSingle();

    if (userErr) throw userErr;

    if (!user) {
      const { data: newUser, error: insErr } = await supabase
        .from('users')
        .insert({
          whatsapp_psid: subscriber_id,
          correct_answer_rate: 0.5,
          streak_count: 0,
          current_question_id: null,
          last_active_at: new Date().toISOString()
        })
        .select('id, whatsapp_psid, current_question_id, correct_answer_rate, streak_count')
        .single();
      if (insErr) throw insErr;
      user = newUser;
    }

    // Branch: answering
    if (user.current_question_id) {
      const { data: question, error: qErr } = await supabase
        .from('mcqs')
        .select('*')
        .eq('id', user.current_question_id)
        .single();

      if (qErr || !question) {
        replyText = "Eish, that question glitched. Let's grab a fresh one. 🔄";
        await supabase
          .from('users')
          .update({ current_question_id: null, last_active_at: new Date().toISOString() })
          .eq('id', user.id);
      } else {
        const userAns = message.trim().toUpperCase();
        const correct = (question.correct_choice || '').trim().toUpperCase();
        const isCorrect = userAns === correct;

        let newStreak = user.streak_count || 0;
        let newRate = updateRate(user.correct_answer_rate, isCorrect);

        if (isCorrect) {
          newStreak += 1;
          replyText = `💯 You nailed it! Streak now: ${newStreak} 🔥\nSay: next for another one.`;
        } else {
          newStreak = 0;
          const choices = parseChoices(question.choices);
          const chosen = choices.find(
            (c) =>
              (c.choice && c.choice.toUpperCase() === userAns) ||
              (!c.choice && userAns === String.fromCharCode(65 + choices.indexOf(c)))
          );
          const weaknessTag = chosen?.weakness_tag || 'that concept';

          // Log weakness
          if (weaknessTag) {
            await supabase.from('user_weaknesses').insert({
              user_id: user.id,
              weakness_tag: weaknessTag,
              logged_at: new Date().toISOString()
            });
          }

          replyText = `Aweh, close one. That slip was about ${weaknessTag}. Correct answer: ${correct}.\nSay: next to keep grinding. 💪`;
        }

        await supabase
          .from('users')
          .update({
            current_question_id: null,
            correct_answer_rate: newRate,
            streak_count: newStreak,
            last_active_at: new Date().toISOString()
          })
          .eq('id', user.id);
      }
    } else {
      // New question branch
      const difficulty = pickDifficulty(user.correct_answer_rate);
      const { data: nextQ, error: nextErr } = await supabase
        .from('mcqs')
        .select('*')
        .eq('difficulty', difficulty)
        .order('last_served_at', { ascending: true, nullsFirst: true })
        .limit(1)
        .maybeSingle();

      if (nextErr) {
        console.error('Fetch question error', nextErr);
      }

      if (!nextQ) {
        replyText = `Shot for pulling through! No more ${difficulty} questions right now. Check back later. ⏳`;
      } else {
        replyText = formatQuestion(nextQ);

        await supabase
          .from('users')
          .update({
            current_question_id: nextQ.id,
            last_active_at: new Date().toISOString()
          })
          .eq('id', user.id);

        await supabase
          .from('mcqs')
          .update({ last_served_at: new Date().toISOString() })
          .eq('id', nextQ.id);
      }
    }

    await sendManyChatReply({ subscriberId: subscriber_id, text: replyText });
    alreadySent = true;
  } catch (err) {
    console.error('Webhook error:', err.message);
    if (!alreadySent) {
      try {
        await sendManyChatReply({
          subscriberId: subscriber_id,
          text: 'Eish, something broke. Give it a sec then send "next" again. 🙏'
        });
      } catch (err2) {
        console.error('Failed to send fallback reply:', err2.message);
      }
    }
  } finally {
    res.status(200).json({ status: 'success', elapsed_ms: Date.now() - start });
  }
}
