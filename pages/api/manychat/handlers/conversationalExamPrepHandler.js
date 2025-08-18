/**
 * Conversational Exam Prep Handler - Emergency Fix
 * Date: 2025-08-18 13:41:27 UTC
 * Author: sophoniagoat
 *
 * EMERGENCY: Insert only absolutely essential fields to avoid VARCHAR(20) error
 */

import { executeQuery } from '../config/database.js';
import { updateUser } from '../services/userService.js';
import { MESSAGES } from '../config/constants.js';

export const conversationalExamPrepHandler = {
  /**
   * Start conversational exam prep with minimal data insertion
   */
  async startConversation(user) {
    try {
      console.log(`🎓 Starting conversational exam prep for user ${user.id}`);

      // EMERGENCY FIX: Insert only the most essential fields
      const sessionId = await executeQuery(async (supabase) => {
        // Insert minimal data first - only required fields
        const minimalData = {
          user_id: user.id,
          // Don't insert status yet - it might be the problematic field
          created_at: new Date().toISOString()
        };

        console.log('🚨 EMERGENCY: Inserting minimal data:', JSON.stringify(minimalData));

        const { data, error } = await supabase
          .from('exam_prep_sessions')
          .insert(minimalData)
          .select('id')
          .single();

        if (error) {
          console.error('❌ Minimal session creation failed:', error);
          throw new Error(`Failed to create exam prep session: ${error.message}`);
        }

        console.log('✅ Minimal session created with ID:', data.id);
        return data.id;
      });

      // Now try to update with additional fields one by one to identify the problem
      await this.updateSessionSafely(sessionId, {
        status: 'active'
      });

      await this.updateSessionSafely(sessionId, {
        conversation_mode: true
      });

      // Create conversation record
      const conversationId = await executeQuery(async (supabase) => {
        const { data, error } = await supabase
          .from('exam_prep_conversations')
          .insert({
            session_id: sessionId,
            user_id: user.id,
            conversation_data: {},
            created_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (error) {
          console.error('❌ Conversation creation failed:', error);
          // Don't throw here, continue without conversation record
          return null;
        }

        return data.id;
      });

      // Update user state
      await updateUser(user.id, {
        current_menu: 'exam_prep_conversation',
        exam_prep_session_id: sessionId,
        conversation_context: JSON.stringify({
          session_id: sessionId,
          conversation_id: conversationId,
          step: 'greeting'
        })
      });

      // Return greeting message
      return this.getGreetingMessage();
    } catch (error) {
      console.error('❌ Conversational exam prep start error:', error);

      // Fallback to traditional exam prep
      return (
        `I'm having trouble starting the conversational setup. Let's use the traditional exam prep instead.\n\n` +
        `What grade are you in? (Type 10, 11, or 12)`
      );
    }
  },

  /**
   * Safely update session with individual field testing
   */
  async updateSessionSafely(sessionId, updateData) {
    try {
      for (const [key, value] of Object.entries(updateData)) {
        console.log(`🔍 Testing field: ${key} = ${value}`);

        // Test each field individually
        await executeQuery(async (supabase) => {
          const { error } = await supabase
            .from('exam_prep_sessions')
            .update({ [key]: value })
            .eq('id', sessionId);

          if (error) {
            console.error(`❌ Field ${key} caused error:`, error);
            // Log the problematic field but don't throw
            if (error.code === '22001') {
              console.error(`🚨 FOUND PROBLEM FIELD: ${key} with value: ${value}`);
              console.error(`🚨 Value length: ${String(value).length}`);
            }
          } else {
            console.log(`✅ Field ${key} updated successfully`);
          }
        });
      }
    } catch (error) {
      console.error('❌ Safe update error:', error);
    }
  },

  /**
   * Get greeting message
   */
  getGreetingMessage() {
    return (
      `Hi! I'm here to help you create a personalized study plan for your upcoming exam. 📚✨\n\n` +
      `Let's start with a few quick questions:\n\n` +
      `What grade are you in? (Type 10, 11, or 12)`
    );
  },

  /**
   * Handle conversation messages (simplified)
   */
  async handleConversationMessage(user, message) {
    try {
      // Parse current context
      let context = {};
      try {
        context = user.conversation_context ? JSON.parse(user.conversation_context) : {};
      } catch (e) {
        context = { step: 'greeting' };
      }

      // Simple conversation flow without database dependencies
      switch (context.step) {
        case 'greeting':
          return this.handleGradeInput(user, message, context);
        case 'grade_collected':
          return this.handleSubjectInput(user, message, context);
        case 'subject_collected':
          return this.handleExamDateInput(user, message, context);
        default:
          return this.completeConversation(user, context);
      }
    } catch (error) {
      console.error('❌ Conversation message error:', error);
      return {
        message: `I encountered an issue. Let's start over. What grade are you in? (Type 10, 11, or 12)`,
        conversation_complete: false
      };
    }
  },

  /**
   * Handle grade input
   */
  async handleGradeInput(user, message, context) {
    const grade = message.trim();

    if (!['10', '11', '12'].includes(grade)) {
      return {
        message: `Please enter a valid grade: 10, 11, or 12.`,
        conversation_complete: false
      };
    }

    // Update user grade
    await updateUser(user.id, {
      grade: grade,
      conversation_context: JSON.stringify({
        ...context,
        step: 'grade_collected',
        grade: grade
      })
    });

    return {
      message:
        `Great! Grade ${grade} it is. 🎓\n\n` +
        `What subject is your exam in? (e.g., Mathematics, Physics, Chemistry)`,
      conversation_complete: false
    };
  },

  /**
   * Handle subject input
   */
  async handleSubjectInput(user, message, context) {
    const subject = message.trim();

    // Update context
    await updateUser(user.id, {
      conversation_context: JSON.stringify({
        ...context,
        step: 'subject_collected',
        subject: subject
      })
    });

    return {
      message:
        `Perfect! ${subject} exam preparation. 📖\n\n` +
        `When is your exam? (Please provide the date in YYYY-MM-DD format or say "next month")`,
      conversation_complete: false
    };
  },

  /**
   * Handle exam date input
   */
  async handleExamDateInput(user, message, context) {
    const dateInput = message.trim().toLowerCase();

    // Simple date parsing
    let examDate;
    if (dateInput.includes('next month') || dateInput.includes('month')) {
      examDate = new Date();
      examDate.setMonth(examDate.getMonth() + 1);
    } else {
      examDate = new Date(dateInput);
      if (isNaN(examDate.getTime())) {
        examDate = new Date();
        examDate.setDate(examDate.getDate() + 30); // Default to 30 days
      }
    }

    // Update context
    await updateUser(user.id, {
      conversation_context: JSON.stringify({
        ...context,
        step: 'completed',
        exam_date: examDate.toISOString()
      })
    });

    return this.completeConversation(user, {
      ...context,
      exam_date: examDate.toISOString()
    });
  },

  /**
   * Complete conversation
   */
  async completeConversation(user, context) {
    const examDate = new Date(context.exam_date);
    const daysUntilExam = Math.ceil((examDate - new Date()) / (1000 * 60 * 60 * 24));

    return {
      message:
        `Excellent! I've gathered all the information I need. 🎯\n\n` +
        `**Your Exam Details:**\n` +
        `• Grade: ${context.grade}\n` +
        `• Subject: ${context.subject}\n` +
        `• Exam Date: ${examDate.toDateString()}\n` +
        `• Days to prepare: ${daysUntilExam}\n\n` +
        `I'm now creating your personalized study plan. This will take a moment...`,
      conversation_complete: true,
      shouldGeneratePlan: true
    };
  }
};
