/**
 * Conversational Exam Prep Handler
 * Date: 2025-08-18 10:44:39 UTC
 * Author: sophoniagoat
 */

import { executeQuery } from '../config/database.js';
import { updateUser } from '../services/userService.js';
import { conversationService } from '../services/conversationService.js';
import { MESSAGES } from '../config/constants.js';
import { dateParser } from '../utils/dateParser.js';

export const conversationalExamPrepHandler = {
  /**
   * Start conversational exam prep flow
   */

  async startConversation(user) {
    try {
      console.log(`🚀 Starting conversational exam prep for user ${user.id}`);

      // Create new exam prep session
      const session = await this.createExamPrepSession(user.id);

      // Update user state
      await updateUser(user.id, {
        current_menu: 'exam_prep_conversation',
        exam_prep_session_id: session.id,
        last_active_at: new Date().toISOString()
      });

      // Helper function to safely truncate all string values
      const safeTruncate = (value, maxLength = 20) => {
        if (value === null || value === undefined) return null;
        if (typeof value !== 'string') return value;
        return value.substring(0, maxLength);
      };

      const sessionData = {
        user_id: user.id,
        status: safeTruncate('active'),
        conversation_mode: true,

        // Truncate any other fields that might be set
        focus_subject: safeTruncate(user.subject),
        exam_type: safeTruncate(user.exam_type),
        grade_level: safeTruncate(user.grade),
        difficulty_level: safeTruncate('medium'),

        // Add debugging info
        context_data: JSON.stringify({ debug: 'Truncated values for safe insertion' }),

        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Log the exact data being inserted for debugging
      console.log('Inserting session data:', JSON.stringify(sessionData));

      // Create exam prep session
 const sessionId = await executeQuery(async (supabase) => {
   const { data, error } = await supabase
     .from('exam_prep_sessions')
     .insert(sessionData)
     .select('id')
     .single();

   if (error) {
     console.error('❌ Session creation failed:', error);
     throw new Error('Failed to create exam prep session');
   }
   return data.id;
 });

      // Initial message
      return MESSAGES.EXAM_PREP.CONVERSATION_START;
    } catch (error) {
      console.error('❌ Conversational exam prep start error:', error);
      return `Eish, I'm having trouble getting started. Let's try the regular way instead. ${MESSAGES.WELCOME.GRADE_PROMPT}`;
    }
  },

  /**
   * Handle conversation message from user
   */
  async handleConversationMessage(user, message) {
    try {
      console.log(`💬 Processing conversation message from user ${user.id}`);

      // Get current session
      const session = await this.getExamPrepSession(user.id);
      if (!session) {
        return {
          message: `I seem to have lost track of our conversation. Let's start again. ${MESSAGES.WELCOME.GRADE_PROMPT}`,
          shouldRestart: true
        };
      }

      // Process message with conversationService
      const response = await conversationService.handleExamPrepConversation(user, message, session);

      // Update session state based on conversation progress
      await this.updateSessionState(session.id, response);

      // Check if we've collected all required data
      if (response.is_data_complete) {
        await updateUser(user.id, {
          current_menu: 'exam_prep_plan'
        });

        // Generate and show study plan
        return {
          message: response.message + '\n\n' + (await this.generateStudyPlan(user, session)),
          conversation_complete: true
        };
      }

      return {
        message: response.message,
        conversation_complete: false
      };
    } catch (error) {
      console.error('❌ Conversation handling error:', error);
      return {
        message:
          "I'm having trouble understanding. Could you tell me which grade you're in and what subject your exam is for?",
        conversation_complete: false
      };
    }
  },

  /**
   * Create a new exam prep session
   */
  async createExamPrepSession(userId) {
    return executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('exam_prep_sessions')
        .insert({
          user_id: userId,
          status: 'active',
          session_state: { step: 'conversation', started_at: new Date().toISOString() },
          created_at: new Date().toISOString(),
          conversation_mode: true
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Session creation failed:', error);
        throw new Error('Failed to create exam prep session');
      }

      return data;
    });
  },

  /**
   * Get current exam prep session
   */
  async getExamPrepSession(userId) {
    return executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('exam_prep_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('❌ Session fetch error:', error);
        return null;
      }

      return data;
    });
  },

  /**
   * Update session state based on conversation progress
   */
  async updateSessionState(sessionId, response) {
    return executeQuery(async (supabase) => {
      await supabase
        .from('exam_prep_sessions')
        .update({
          session_state: {
            step: response.conversation_state,
            is_data_complete: response.is_data_complete,
            last_updated: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
    });
  },

  /**
   * Generate study plan based on collected information
   */
  async generateStudyPlan(user, session) {
    // Format exam date
    let examDateDisplay = 'your upcoming test';
    if (session.exam_date) {
      const examDate = new Date(session.exam_date);
      const now = new Date();
      const daysUntilExam = Math.ceil((examDate - now) / (1000 * 60 * 60 * 24));

      examDateDisplay =
        daysUntilExam > 0 ? `your test in ${daysUntilExam} days` : 'your test today';
    }

    // Format topics
    const topics = session.focus_topics || [];
    const topicsDisplay =
      topics.length > 0 ? `focusing on ${topics.join(', ')}` : 'covering key concepts';

    // Create plan
    return `📅 **YOUR PERSONALIZED STUDY PLAN**

I've created a daily study plan for ${examDateDisplay}, ${topicsDisplay}.

Your plan includes:
• Daily lessons tailored to your needs
• Practice questions to build confidence
• Progress tracking to ensure mastery

Your daily reminders will be sent at: ${session.preferred_time || '7:00 PM'}

Ready to start your first lesson? Just reply "yes" and we'll begin immediately!`;
  }
};
