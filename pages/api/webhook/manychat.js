import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract psid and message from request body
    const { psid, message } = req.body;

    if (!psid || !message) {
      return res.status(400).json({ error: 'Invalid body (psid, message required)' });
    }

    // Find or create user
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('whatsapp_psid', psid)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      throw userError;
    }

    // Create new user if doesn't exist
    if (!user) {
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          whatsapp_psid: psid,
          correct_answer_rate: 0.5,
          streak_count: 0,
          current_question_id: null,
          last_active_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) throw createError;
      user = newUser;
    }

    let responseMessage = '';

    // Branch 1: User is answering a question
    if (user.current_question_id) {
      // Fetch the current question
      const { data: mcq, error: mcqError } = await supabase
        .from('mcqs')
        .select('*')
        .eq('id', user.current_question_id)
        .single();

      if (mcqError) throw mcqError;

      const userAnswer = message.trim().toUpperCase();
      const correctChoice = mcq.correct_choice.toUpperCase();

      let newRate = user.correct_answer_rate;
      let newStreak = user.streak_count;

      if (userAnswer === correctChoice) {
        // Correct answer
        newStreak += 1;
        newRate = (user.correct_answer_rate * 4 + 1) / 5;

        const streakMessages = [
          '💯 You nailed it! Keep the streak going!',
          "🔥 Sharp shooter! That's the spirit!",
          "⚡ Aweh! You're on fire today!",
          '🎯 Yebo! Another one bites the dust!'
        ];

        responseMessage = streakMessages[Math.floor(Math.random() * streakMessages.length)];

        if (newStreak > 1) {
          responseMessage += ` Streak: ${newStreak} 🚀`;
        }
      } else {
        // Incorrect answer
        newStreak = 0;
        newRate = (user.correct_answer_rate * 4 + 0) / 5;

        // Find the weakness tag for the chosen answer
        let weaknessTag = null;
        if (mcq.choices && typeof mcq.choices === 'object') {
          const choices = Array.isArray(mcq.choices) ? mcq.choices : Object.values(mcq.choices);
          const chosenChoice = choices.find(
            (choice) => choice.letter && choice.letter.toUpperCase() === userAnswer
          );
          if (chosenChoice && chosenChoice.weakness_tag) {
            weaknessTag = chosenChoice.weakness_tag;

            // Log weakness
            await supabase.from('user_weaknesses').insert({
              user_id: user.id,
              weakness_tag: weaknessTag,
              created_at: new Date().toISOString()
            });
          }
        }

        responseMessage = 'Aweh, good try! ';
        if (weaknessTag) {
          responseMessage += `That's a classic slip-up with ${weaknessTag}. Double-check that next time! `;
        }
        responseMessage += `The correct answer was ${correctChoice}. Let's keep pushing! 💪`;
      }

      // Update user state
      await supabase
        .from('users')
        .update({
          current_question_id: null,
          correct_answer_rate: newRate,
          streak_count: newStreak,
          last_active_at: new Date().toISOString()
        })
        .eq('id', user.id);
    } else {
      // Branch 2: Serve new question
      // Determine difficulty based on correct_answer_rate
      let difficulty = 'easy';
      if (user.correct_answer_rate >= 0.7) {
        difficulty = 'hard';
      } else if (user.correct_answer_rate >= 0.5) {
        difficulty = 'medium';
      }

      // Fetch next question
      const { data: questions, error: questionError } = await supabase
        .from('mcqs')
        .select('*')
        .eq('difficulty', difficulty)
        .order('last_served_at', { ascending: true, nullsFirst: true })
        .limit(1);

      if (questionError) throw questionError;

      if (questions && questions.length > 0) {
        const question = questions[0];

        // Format question for WhatsApp
        let formattedQuestion = `${question.question_text}\n\n`;

        if (question.choices && typeof question.choices === 'object') {
          const choices = Array.isArray(question.choices)
            ? question.choices
            : Object.values(question.choices);
          choices.forEach((choice) => {
            if (choice.letter && choice.text) {
              formattedQuestion += `${choice.letter}) ${choice.text}\n`;
            }
          });
        }

        // Welcome message for new users or returning users
        if (user.streak_count === 0 && user.correct_answer_rate === 0.5) {
          responseMessage = `Howzit! Welcome to The GOAT 🐐\n\nReady to boost your math skills? Let's start with this one:\n\n${formattedQuestion}`;
        } else {
          responseMessage = `Here's your next challenge:\n\n${formattedQuestion}`;
        }

        // Update user with current question
        await supabase
          .from('users')
          .update({
            current_question_id: question.id,
            last_active_at: new Date().toISOString()
          })
          .eq('id', user.id);

        // Update question last_served_at
        await supabase
          .from('mcqs')
          .update({
            last_served_at: new Date().toISOString()
          })
          .eq('id', question.id);
      } else {
        responseMessage =
          "Eish! We're working on adding more questions for you. Check back soon! 📚";
      }
    }

    // Return response with echo field for ManyChat
    return res.status(200).json({
      status: 'success',
      echo: responseMessage
    });
  } catch (error) {
    console.error('Webhook error:', error);

    // Return a user-friendly error message
    return res.status(200).json({
      status: 'success',
      echo: 'Oops! Something went wrong on our side. Please try again in a moment! 🔧'
    });
  }
}
