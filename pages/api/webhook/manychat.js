// The GOAT - ManyChat Webhook Handler
// Author: mankwemokgabudi
// Date: 2025-08-13 11:39:00 UTC
// Purpose: Handle WhatsApp messages via ManyChat integration

const { createClient } = require('@supabase/supabase-js');

// Environment validation
function validateEnvironment() {
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'MANYCHAT_API_TOKEN'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`❌ Missing environment variables: ${missing.join(', ')}`);
    return false;
  }

  console.log(`✅ All required environment variables present`);
  return true;
}

// Enhanced ManyChat API function with multiple endpoint fallbacks
async function sendManyChatReply(psid, message) {
  try {
    console.log(`🔄 Sending to ManyChat PSID: ${psid}`);
    console.log(`📝 Message: ${message}`);
    console.log(`🔑 API Token exists: ${!!process.env.MANYCHAT_API_TOKEN}`);
    console.log(`🔑 Token preview: ${process.env.MANYCHAT_API_TOKEN?.substring(0, 10)}...`);

    // Method 1: Try the primary ManyChat endpoint
    console.log(`🔄 Attempting primary endpoint...`);

    const payload1 = {
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

    const response1 = await fetch('https://api.manychat.com/fb/sending/sendContent', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MANYCHAT_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload1)
    });

    console.log(`📥 Primary endpoint response: ${response1.status}`);

    if (response1.ok) {
      const responseData = await response1.json();
      console.log(`✅ Primary endpoint success:`, responseData);
      return true;
    }

    const error1Text = await response1.text();
    console.log(`❌ Primary endpoint failed: ${response1.status} - ${error1Text}`);

    // Method 2: Try alternative endpoint
    console.log(`🔄 Attempting alternative endpoint...`);

    const payload2 = {
      subscriber_id: psid,
      messages: [
        {
          type: 'text',
          text: message
        }
      ]
    };

    const response2 = await fetch('https://api.manychat.com/fb/subscriber/sendContent', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MANYCHAT_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload2)
    });

    console.log(`📥 Alternative endpoint response: ${response2.status}`);

    if (response2.ok) {
      const responseData = await response2.json();
      console.log(`✅ Alternative endpoint success:`, responseData);
      return true;
    }

    const error2Text = await response2.text();
    console.log(`❌ Alternative endpoint failed: ${response2.status} - ${error2Text}`);

    // Method 3: Try legacy endpoint
    console.log(`🔄 Attempting legacy endpoint...`);

    const payload3 = {
      subscriber_id: psid,
      message_text: message
    };

    const response3 = await fetch('https://api.manychat.com/fb/sending/sendText', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MANYCHAT_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload3)
    });

    console.log(`📥 Legacy endpoint response: ${response3.status}`);

    if (response3.ok) {
      const responseData = await response3.json();
      console.log(`✅ Legacy endpoint success:`, responseData);
      return true;
    }

    const error3Text = await response3.text();
    console.log(`❌ Legacy endpoint failed: ${response3.status} - ${error3Text}`);

    // Method 4: Try original endpoint with simplified payload
    console.log(`🔄 Attempting original endpoint with simple payload...`);

    const payload4 = {
      subscriber_id: psid,
      text: message
    };

    const response4 = await fetch('https://api.manychat.com/fb/sender', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MANYCHAT_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload4)
    });

    console.log(`📥 Original endpoint response: ${response4.status}`);

    if (response4.ok) {
      const responseData = await response4.json();
      console.log(`✅ Original endpoint success:`, responseData);
      return true;
    }

    const error4Text = await response4.text();
    console.log(`❌ Original endpoint failed: ${response4.status} - ${error4Text}`);

    // All methods failed
    console.error(`❌ All ManyChat API attempts failed`);
    console.error(`Primary: ${response1.status} - ${error1Text}`);
    console.error(`Alternative: ${response2.status} - ${error2Text}`);
    console.error(`Legacy: ${response3.status} - ${error3Text}`);
    console.error(`Original: ${response4.status} - ${error4Text}`);

    return false;
  } catch (error) {
    console.error('❌ Exception in sendManyChatReply:', error);
    return false;
  }
}

// Helper function to find or create user
async function findOrCreateUser(psid, supabase) {
  try {
    console.log(`🔍 Looking for user with PSID: ${psid}`);

    // Try to find existing user
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('whatsapp_psid', psid)
      .single();

    if (existingUser) {
      console.log(`✅ Found existing user: ${existingUser.id}`);
      return existingUser;
    }

    if (findError && findError.code !== 'PGRST116') {
      console.error('❌ Error finding user:', findError);
      throw findError;
    }

    console.log(`🆕 Creating new user for PSID: ${psid}`);

    // Create new user with all required fields
    const newUserData = {
      whatsapp_psid: psid,
      current_state: 'consent_pending',
      consented_daily: false,
      preferred_send_hour: 16,
      timezone_offset_minutes: 120, // SAST default
      streak_count: 0,
      correct_answer_rate: 0.0,
      daily_session_complete: false,
      total_questions_answered: 0,
      total_correct_answers: 0,
      session_question_count: 0,
      current_question_id: null,
      current_subject_id: null,
      last_active_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log(`📝 Creating user with data:`, newUserData);

    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert(newUserData)
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating user:', createError);
      throw createError;
    }

    console.log(`✅ Created new user: ${newUser.id}`);
    return newUser;
  } catch (error) {
    console.error('❌ Error finding/creating user:', error);
    return null;
  }
}

// Helper function to update user state
async function updateUserState(userId, newState, supabase) {
  try {
    const { error } = await supabase
      .from('users')
      .update({
        current_state: newState,
        updated_at: new Date().toISOString(),
        last_active_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('❌ Error updating user state:', error);
      return false;
    }

    console.log(`✅ Updated user ${userId} state to: ${newState}`);
    return true;
  } catch (error) {
    console.error('❌ Exception updating user state:', error);
    return false;
  }
}

// Handle consent pending state
async function handleConsentPending(user, userMessage, psid, supabase) {
  const message = userMessage.toLowerCase().trim();

  if (message === 'yes' || message === 'y' || message === 'yebo' || message === 'ja') {
    // User consented
    await updateUserState(user.id, 'subject_selection', supabase);
    const response = `Yebo! 🔥 Welcome to The GOAT family!\n\nWhich math topic needs work today?\n\n1️⃣ Algebra\n2️⃣ Geometry\n3️⃣ Trigonometry\n4️⃣ Calculus\n\nJust send the number! 🎯`;
    await sendManyChatReply(psid, response);
  } else if (message === 'no' || message === 'n' || message === 'nah') {
    // User declined
    const response = `No worries! 😊 When you're ready to ace those math exams, just send YES! 🐐`;
    await sendManyChatReply(psid, response);
  } else {
    // Unclear response
    const response = `Howzit! 🐐 Welcome to The GOAT - your daily math practice buddy!\n\nReady to ace those exams? Send YES to get started! 💪\n\n(Send YES or NO)`;
    await sendManyChatReply(psid, response);
  }
}

// Handle subject selection state
async function handleSubjectSelection(user, userMessage, psid, supabase) {
  const message = userMessage.trim();

  const subjects = {
    1: 'Algebra',
    2: 'Geometry',
    3: 'Trigonometry',
    4: 'Calculus'
  };

  if (subjects[message]) {
    // Valid subject selected
    await updateUserState(user.id, 'time_preference', supabase);
    const response = `Sharp choice! 📚 ${subjects[message]} it is!\n\nWhen should I send your daily practice?\n\n🌅 Morning (8AM)\n🌞 Afternoon (2PM) \n🌆 Evening (6PM)\n\nJust say Morning, Afternoon, or Evening! ⏰`;
    await sendManyChatReply(psid, response);
  } else {
    // Invalid selection
    const response = `Eish, I didn't catch that! 🤔\n\nWhich math topic needs work?\n\n1️⃣ Algebra\n2️⃣ Geometry\n3️⃣ Trigonometry\n4️⃣ Calculus\n\nJust send the number (1, 2, 3, or 4)! 🎯`;
    await sendManyChatReply(psid, response);
  }
}

// Handle time preference state
async function handleTimePreference(user, userMessage, psid, supabase) {
  const message = userMessage.toLowerCase().trim();

  let hour = null;
  let timeSlot = '';

  if (message.includes('morning') || message.includes('8')) {
    hour = 8;
    timeSlot = 'Morning';
  } else if (message.includes('afternoon') || message.includes('2')) {
    hour = 14;
    timeSlot = 'Afternoon';
  } else if (message.includes('evening') || message.includes('6')) {
    hour = 18;
    timeSlot = 'Evening';
  }

  if (hour) {
    // Valid time selected
    await supabase
      .from('users')
      .update({
        preferred_send_hour: hour,
        consented_daily: true,
        current_state: 'idle',
        updated_at: new Date().toISOString(),
        last_active_at: new Date().toISOString()
      })
      .eq('id', user.id);

    const response = `Perfect! 🎯 You're all set for ${timeSlot} practice sessions!\n\n🐐 Send START anytime for instant practice\n⚡ Daily sessions at ${timeSlot}\n🔥 Let's build that streak!\n\nReady to start? Send START! 💪`;
    await sendManyChatReply(psid, response);
  } else {
    // Invalid time
    const response = `Hmm, not sure about that time! 🤔\n\nWhen should I send your daily practice?\n\n🌅 Morning (8AM)\n🌞 Afternoon (2PM) \n🌆 Evening (6PM)\n\nJust say Morning, Afternoon, or Evening! ⏰`;
    await sendManyChatReply(psid, response);
  }
}

// Handle idle state (main interaction state)
async function handleIdleState(user, userMessage, psid, supabase) {
  const message = userMessage.toLowerCase().trim();

  if (message === 'start' || message === 'begin' || message === 'practice') {
    // Start practice session
    await updateUserState(user.id, 'hook_sent', supabase);
    const response = `Yebo! 🔥 Let's get that brain working!\n\nMath fact: Students who practice 10 minutes daily improve 3x faster! 📈\n\nReady for your first question? Send READY! 🎯`;
    await sendManyChatReply(psid, response);
  } else if (message === 'help' || message === 'info') {
    // Help message
    const response = `Hey champion! 🐐 Here's what I can do:\n\n📚 Send START for practice\n⚡ Get daily sessions\n🔥 Build your streak\n📈 Track progress\n\nSend START to begin! 💪`;
    await sendManyChatReply(psid, response);
  } else {
    // Default response
    const response = `Howzit! 🐐 Ready for some math practice?\n\nSend START to begin your session! 💪\n\n(Or send HELP for more options)`;
    await sendManyChatReply(psid, response);
  }
}

// Handle hook sent state
async function handleHookSent(user, userMessage, psid, supabase) {
  const message = userMessage.toLowerCase().trim();

  if (message === 'ready' || message === 'yes' || message === 'go') {
    // User is ready for question
    await updateUserState(user.id, 'question_sent', supabase);

    // For now, send a simple placeholder question
    // TODO: Fetch actual question from database
    const response = `🧮 QUESTION 1:\n\nSolve for x:\n2x + 5 = 13\n\nA) x = 3\nB) x = 4  \nC) x = 5\nD) x = 6\n\nSend A, B, C, or D! ⏰`;
    await sendManyChatReply(psid, response);
  } else {
    // Motivate user
    const response = `No pressure! 😊 Take your time...\n\nWhen you're ready to tackle this question, just send READY! 🎯\n\n(Remember: Every expert was once a beginner! 🐐)`;
    await sendManyChatReply(psid, response);
  }
}

// Handle question sent state
async function handleQuestionSent(user, userMessage, psid, supabase) {
  const answer = userMessage.toUpperCase().trim();

  if (['A', 'B', 'C', 'D'].includes(answer)) {
    // Valid answer format
    const correctAnswer = 'B'; // Placeholder - should come from database

    if (answer === correctAnswer) {
      // Correct answer
      await updateUserState(user.id, 'idle', supabase);
      const response = `🎉 BOOM! Correct! 💯\n\nx = 4 is right! 🔥\n\n2(4) + 5 = 8 + 5 = 13 ✅\n\nYou're on fire! 🐐 Send START for another question! 💪`;
      await sendManyChatReply(psid, response);
    } else {
      // Wrong answer
      await updateUserState(user.id, 'idle', supabase);
      const response = `Eish, not quite! 😅 The answer was B) x = 4\n\nHere's how:\n2x + 5 = 13\n2x = 13 - 5\n2x = 8\nx = 4 ✅\n\nNo worries! Send START to try another! 🎯`;
      await sendManyChatReply(psid, response);
    }
  } else {
    // Invalid answer format
    const response = `Please send A, B, C, or D for your answer! 🎯\n\nThe question is:\n2x + 5 = 13\n\nA) x = 3\nB) x = 4\nC) x = 5  \nD) x = 6`;
    await sendManyChatReply(psid, response);
  }
}

// Main webhook handler
export default async function handler(req, res) {
  console.log(`🚀 Webhook called at ${new Date().toISOString()}`);
  console.log(`📥 Method: ${req.method}`);
  console.log(`📝 Body:`, JSON.stringify(req.body, null, 2));

  // Validate environment first
  if (!validateEnvironment()) {
    console.error(`❌ Environment validation failed`);
    return res.status(200).json({ status: 'success', note: 'Configuration issue' });
  }

  if (req.method !== 'POST') {
    console.log(`❌ Method not allowed: ${req.method}`);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Support multiple field name variations from ManyChat
    const { psid, text, message, last_input_text } = req.body;
    const userMessage = text || message || last_input_text;

    console.log(`📊 Extracted: PSID=${psid}, Message="${userMessage}"`);

    if (!psid || !userMessage) {
      console.log(`❌ Missing fields: psid=${psid}, message=${userMessage}`);
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Initialize Supabase client
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    // Find or create user
    const user = await findOrCreateUser(psid, supabase);
    if (!user) {
      console.log(`❌ Failed to find/create user for PSID: ${psid}`);
      return res.status(200).json({ status: 'success', note: 'User creation failed' });
    }

    console.log(`✅ User loaded: ${user.id}, State: ${user.current_state}`);

    // Route based on current state
    switch (user.current_state) {
      case 'consent_pending':
        await handleConsentPending(user, userMessage, psid, supabase);
        break;

      case 'subject_selection':
        await handleSubjectSelection(user, userMessage, psid, supabase);
        break;

      case 'time_preference':
        await handleTimePreference(user, userMessage, psid, supabase);
        break;

      case 'idle':
      case 'declined_daily':
      case 'session_complete':
        await handleIdleState(user, userMessage, psid, supabase);
        break;

      case 'hook_sent':
        await handleHookSent(user, userMessage, psid, supabase);
        break;

      case 'question_sent':
        await handleQuestionSent(user, userMessage, psid, supabase);
        break;

      case 'answered_question':
        await handleIdleState(user, userMessage, psid, supabase);
        break;

      case 'additional_question_sent':
        await handleQuestionSent(user, userMessage, psid, supabase);
        break;

      default:
        console.log(`⚠️ Unknown state: ${user.current_state}, resetting to idle`);
        await updateUserState(user.id, 'idle', supabase);
        const response = 'Howzit! 🐐 Send START for your daily practice session 👍';
        await sendManyChatReply(psid, response);
        break;
    }

    console.log(`✅ Webhook completed successfully`);
    return res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('❌ Webhook error:', error);

    // Best effort user notification (only if we have psid)
    try {
      if (req.body?.psid) {
        await sendManyChatReply(
          req.body.psid,
          'Eish, something glitched. Try again in a moment 🔄'
        );
      }
    } catch (notificationError) {
      console.error('❌ Failed to send error notification:', notificationError);
    }

    // Always return 200 to prevent ManyChat retries
    return res.status(200).json({ status: 'success' });
  }
}
