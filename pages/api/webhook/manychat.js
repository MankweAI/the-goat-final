import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper function to send messages to ManyChat
async function sendManyChatReply(psid, text) {
  const token = process.env.MANYCHAT_API_TOKEN;

  if (!token) {
    console.error('❌ MANYCHAT_API_TOKEN not found in environment variables');
    throw new Error('ManyChat API token not configured');
  }

  console.log(`🔄 Sending to ManyChat PSID: ${psid}`);
  console.log(`📝 Message: ${text}`);
  console.log(`🔑 API Token exists: ${!!token}`);
  console.log(`🔑 Token preview: ${token.substring(0, 10)}...`);

  const payload = {
    subscriber_id: psid,
    data: {
      version: 'v2',
      content: {
        messages: [
          {
            type: 'text',
            text: text
          }
        ]
      }
    }
  };

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // Primary endpoint (current ManyChat API)
  const primaryUrl = 'https://api.manychat.com/fb/sending/sendContent';

  try {
    console.log('🔄 Attempting primary endpoint...');
    const response = await fetch(primaryUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    console.log(`📥 Primary endpoint response: ${response.status}`);

    if (response.ok) {
      const result = await response.text();
      console.log('✅ Message sent successfully via primary endpoint');
      return result;
    } else {
      const errorText = await response.text();
      console.log(`❌ Primary endpoint failed: ${response.status} - ${errorText}`);
      throw new Error(`Primary endpoint failed: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Primary endpoint error:', error.message);

    // Fallback to alternative endpoint
    const altUrl = 'https://api.manychat.com/fb/subscriber/sendContent';

    try {
      console.log('🔄 Attempting alternative endpoint...');
      const altResponse = await fetch(altUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      console.log(`📥 Alternative endpoint response: ${altResponse.status}`);

      if (altResponse.ok) {
        const result = await altResponse.text();
        console.log('✅ Message sent successfully via alternative endpoint');
        return result;
      } else {
        const errorText = await altResponse.text();
        console.log(`❌ Alternative endpoint failed: ${altResponse.status} - ${errorText}`);
        throw new Error(`Alternative endpoint failed: ${altResponse.status}`);
      }
    } catch (altError) {
      console.error('❌ Alternative endpoint error:', altError.message);

      // Final fallback - legacy format
      const legacyPayload = {
        subscriber_id: psid,
        message_text: text
      };

      const legacyUrl = 'https://api.manychat.com/fb/sending/sendContent';

      try {
        console.log('🔄 Attempting legacy format...');
        const legacyResponse = await fetch(legacyUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(legacyPayload)
        });

        console.log(`📥 Legacy endpoint response: ${legacyResponse.status}`);

        if (legacyResponse.ok) {
          const result = await legacyResponse.text();
          console.log('✅ Message sent successfully via legacy format');
          return result;
        } else {
          const errorText = await legacyResponse.text();
          console.log(`❌ Legacy format failed: ${legacyResponse.status} - ${errorText}`);
          throw new Error(`All endpoints failed. Last error: ${legacyResponse.status}`);
        }
      } catch (legacyError) {
        console.error('❌ All ManyChat API attempts failed');
        console.error('Primary:', error.message);
        console.error('Alternative:', altError.message);
        console.error('Legacy:', legacyError.message);
        throw new Error('Failed to send message to ManyChat after all attempts');
      }
    }
  }
}

// Helper function to determine difficulty based on user's performance
function getDifficultyForUser(correctAnswerRate) {
  if (correctAnswerRate >= 0.8) return 'hard';
  if (correctAnswerRate >= 0.5) return 'medium';
  return 'easy';
}

// Helper function to update user's correct answer rate
function updateCorrectAnswerRate(currentRate, isCorrect) {
  // Weighted average: give more weight to recent performance
  const weight = 0.2; // 20% weight to new answer, 80% to historical
  return isCorrect ? currentRate * (1 - weight) + weight : currentRate * (1 - weight);
}

// Main webhook handler
export default async function handler(req, res) {
  const timestamp = new Date().toISOString();
  console.log(`🚀 Webhook called at ${timestamp}`);
  console.log(`📥 Method: ${req.method}`);
  console.log(`📝 Body:`, JSON.stringify(req.body, null, 2));

  // Only accept POST requests
  if (req.method !== 'POST') {
    console.log('❌ Non-POST request rejected');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check environment variables
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'MANYCHAT_API_TOKEN'
    ];

    const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
    if (missingVars.length > 0) {
      console.error('❌ Missing environment variables:', missingVars);
      return res.status(500).json({ error: 'Server configuration error' });
    }

    console.log('✅ All required environment variables present');

    // Extract data from request body
    const { psid, message } = req.body;

    if (!psid || !message) {
      console.log('❌ Missing required fields: psid or message');
      return res.status(400).json({ error: 'Missing psid or message' });
    }

    console.log(`📊 Extracted: PSID=${psid}, Message="${message}"`);

    // Find or create user
    console.log(`🔍 Looking for user with PSID: ${psid}`);

    let { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('whatsapp_psid', psid)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      console.error('❌ Database error fetching user:', userError);
      throw userError;
    }

    // Create user if doesn't exist
    if (!user) {
      console.log('👤 Creating new user');
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          whatsapp_psid: psid,
          user_state: 'subject_selection',
          correct_answer_rate: 0.5,
          streak_count: 0,
          current_question_id: null,
          last_active_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating user:', createError);
        throw createError;
      }

      user = newUser;
      console.log('✅ New user created:', user.id);
    } else {
      console.log('✅ Found existing user:', user.id);
    }

    console.log(`✅ User loaded: ${user.id}, State: ${user.user_state}`);

    let replyMessage = '';

    // Handle different user states
    if (user.user_state === 'subject_selection') {
      // User is in subject selection mode
      const trimmedMessage = message.trim();

      if (['1', '2', '3', '4'].includes(trimmedMessage)) {
        const subjects = {
          1: 'algebra',
          2: 'geometry',
          3: 'trigonometry',
          4: 'calculus'
        };

        const selectedSubject = subjects[trimmedMessage];
        console.log(`📚 User selected subject: ${selectedSubject}`);

        // Update user state to active and set subject
        await supabase
          .from('users')
          .update({
            user_state: 'active',
            selected_subject: selectedSubject,
            last_active_at: new Date().toISOString()
          })
          .eq('id', user.id);

        // Get first question for this subject
        const difficulty = getDifficultyForUser(user.correct_answer_rate);

        const { data: question, error: questionError } = await supabase
          .from('mcqs')
          .select('*')
          .eq('topic', selectedSubject)
          .eq('difficulty', difficulty)
          .order('last_served_at', { ascending: true, nullsFirst: true })
          .limit(1)
          .single();

        if (questionError || !question) {
          console.log('❌ No questions found for subject:', selectedSubject);
          replyMessage = `Sharp choice on ${selectedSubject.charAt(0).toUpperCase() + selectedSubject.slice(1)}! 📚\n\nWe're still loading questions for this topic. Check back soon - we'll have some fire problems for you! 🔥`;
        } else {
          // Format question for WhatsApp
          replyMessage = `🎯 ${selectedSubject.charAt(0).toUpperCase() + selectedSubject.slice(1)} Question:\n\n${question.question_text}\n\n`;

          const choices = JSON.parse(question.choices);
          choices.forEach((choice, index) => {
            replyMessage += `${String.fromCharCode(65 + index)}) ${choice.text}\n`;
          });

          replyMessage += `\nJust send the letter (A, B, C, or D)! 💪`;

          // Update user with current question
          await supabase
            .from('users')
            .update({
              current_question_id: question.id,
              last_active_at: new Date().toISOString()
            })
            .eq('id', user.id);

          // Update question's last served time
          await supabase
            .from('mcqs')
            .update({ last_served_at: new Date().toISOString() })
            .eq('id', question.id);
        }
      } else {
        // Invalid subject selection
        replyMessage = `Eish, I didn't catch that! 🤔\n\nWhich math topic needs work?\n\n1️⃣ Algebra\n2️⃣ Geometry\n3️⃣ Trigonometry\n4️⃣ Calculus\n\nJust send the number (1, 2, 3, or 4)! 🎯`;
      }
    } else if (user.current_question_id) {
      // User is answering a question
      console.log(`🤔 User answering question: ${user.current_question_id}`);

      // Get the current question
      const { data: question, error: questionError } = await supabase
        .from('mcqs')
        .select('*')
        .eq('id', user.current_question_id)
        .single();

      if (questionError || !question) {
        console.error('❌ Question not found:', user.current_question_id);
        replyMessage = "Something went wrong! Let's start fresh. 🔄";

        // Reset user state
        await supabase
          .from('users')
          .update({
            current_question_id: null,
            user_state: 'subject_selection',
            last_active_at: new Date().toISOString()
          })
          .eq('id', user.id);
      } else {
        // Check the answer
        const userAnswer = message.trim().toUpperCase();
        const correctAnswer = question.correct_choice.toUpperCase();
        const isCorrect = userAnswer === correctAnswer;

        console.log(
          `✅ User answer: ${userAnswer}, Correct: ${correctAnswer}, Match: ${isCorrect}`
        );

        let newStreakCount = user.streak_count;
        let newCorrectAnswerRate = updateCorrectAnswerRate(user.correct_answer_rate, isCorrect);

        if (isCorrect) {
          // Correct answer
          newStreakCount += 1;
          replyMessage = `💯 You nailed it! Keep the streak going!\n\nStreak: ${newStreakCount} 🔥\n\nReady for another one? Send "next" for more practice! 💪`;
        } else {
          // Incorrect answer
          newStreakCount = 0;

          // Find the weakness tag for the chosen answer
          const choices = JSON.parse(question.choices);
          const chosenChoice = choices.find((choice) => choice.choice === userAnswer);
          const weaknessTag = chosenChoice ? chosenChoice.weakness_tag : 'general';

          // Log the weakness
          if (chosenChoice && weaknessTag) {
            await supabase.from('user_weaknesses').insert({
              user_id: user.id,
              weakness_tag: weaknessTag,
              logged_at: new Date().toISOString()
            });
          }

          replyMessage = `Aweh, good try! 🤝 That's a classic slip-up with ${weaknessTag}. Double-check that next time!\n\nThe right answer was ${correctAnswer}. Don't stress - that's how we learn! 💪\n\nSend "next" to keep going! 🔥`;
        }

        // Update user stats and clear current question
        await supabase
          .from('users')
          .update({
            current_question_id: null,
            streak_count: newStreakCount,
            correct_answer_rate: newCorrectAnswerRate,
            user_state: 'active',
            last_active_at: new Date().toISOString()
          })
          .eq('id', user.id);
      }
    } else {
      // User wants a new question or general interaction
      const normalizedMessage = message.trim().toLowerCase();

      if (
        normalizedMessage === 'next' ||
        normalizedMessage.includes('question') ||
        normalizedMessage.includes('another')
      ) {
        // User wants a new question
        const difficulty = getDifficultyForUser(user.correct_answer_rate);
        const subject = user.selected_subject || 'algebra'; // Default fallback

        const { data: question, error: questionError } = await supabase
          .from('mcqs')
          .select('*')
          .eq('topic', subject)
          .eq('difficulty', difficulty)
          .order('last_served_at', { ascending: true, nullsFirst: true })
          .limit(1)
          .single();

        if (questionError || !question) {
          replyMessage = `No more ${difficulty} ${subject} questions right now! 📚\n\nWant to try a different subject? Send:\n1️⃣ Algebra\n2️⃣ Geometry\n3️⃣ Trigonometry\n4️⃣ Calculus`;

          // Set back to subject selection
          await supabase
            .from('users')
            .update({
              user_state: 'subject_selection',
              last_active_at: new Date().toISOString()
            })
            .eq('id', user.id);
        } else {
          // Format and send new question
          replyMessage = `🎯 ${subject.charAt(0).toUpperCase() + subject.slice(1)} Question:\n\n${question.question_text}\n\n`;

          const choices = JSON.parse(question.choices);
          choices.forEach((choice, index) => {
            replyMessage += `${String.fromCharCode(65 + index)}) ${choice.text}\n`;
          });

          replyMessage += `\nJust send the letter (A, B, C, or D)! 💪`;

          // Update user with new question
          await supabase
            .from('users')
            .update({
              current_question_id: question.id,
              last_active_at: new Date().toISOString()
            })
            .eq('id', user.id);

          // Update question's last served time
          await supabase
            .from('mcqs')
            .update({ last_served_at: new Date().toISOString() })
            .eq('id', question.id);
        }
      } else {
        // General greeting or unknown command
        replyMessage = `Howzit! Welcome to The GOAT! 🐐\n\nI'm here to help you crush your math exams. Which topic do you want to practice?\n\n1️⃣ Algebra\n2️⃣ Geometry\n3️⃣ Trigonometry\n4️⃣ Calculus\n\nJust send the number! 🎯`;

        // Set to subject selection mode
        await supabase
          .from('users')
          .update({
            user_state: 'subject_selection',
            current_question_id: null,
            last_active_at: new Date().toISOString()
          })
          .eq('id', user.id);
      }
    }

    // Send reply to ManyChat
    await sendManyChatReply(psid, replyMessage);

    // Return success response to ManyChat
    console.log('✅ Webhook completed successfully');
    return res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('❌ Webhook error:', error);

    // Try to send a generic error message to user
    try {
      const { psid } = req.body;
      if (psid) {
        await sendManyChatReply(
          psid,
          'Eish, something went wrong on my side! 😅 Try sending another message in a few seconds.'
        );
      }
    } catch (replyError) {
      console.error('❌ Failed to send error message:', replyError);
    }

    // Always return 200 to ManyChat to prevent retries
    return res.status(200).json({ status: 'error', message: error.message });
  }
}
