/**
 * Conversation Service - Manages GPT-powered conversations
 * Date: 2025-08-18 10:44:39 UTC
 * Author: sophoniagoat
 */

import { getOpenAIClient, OPENAI_CONFIG } from '../config/openai.js';
import { executeQuery } from '../config/database.js';

export class ConversationService {
  constructor() {
    this.client = null;
  }

  async getClient() {
    if (!this.client) {
      this.client = getOpenAIClient();
    }
    return this.client;
  }

  /**
   * Start or continue a conversational intake for exam prep
   * @param {Object} user - User object from database
   * @param {string} userMessage - Current message from the user
   * @param {Object} session - Current exam_prep_session if exists
   * @returns {Object} Response and extracted data
   */
  async handleExamPrepConversation(user, userMessage, session) {
    try {
      console.log(`🗣️ Processing exam prep conversation for user ${user.id}`);

      // Retrieve or initialize conversation history
      const conversationHistory = await this.getConversationHistory(session.id);

      // Build system prompt
      const systemPrompt = this.buildExamPrepSystemPrompt(user);

      // Add user message to history
      conversationHistory.push({
        role: 'user',
        content: userMessage
      });

      // Call GPT for response
      const client = await this.getClient();
      const completion = await client.chat.completions.create({
        model: OPENAI_CONFIG.MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory.slice(-10) // Keep conversation context manageable
        ],
        max_tokens: 500,
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });

      // Parse response
      const response = JSON.parse(completion.choices[0].message.content);

      // Add assistant response to history
      conversationHistory.push({
        role: 'assistant',
        content: response.message
      });

      // Save conversation history
      await this.saveConversationHistory(session.id, conversationHistory);

      // Extract and save any structured data
      if (response.extracted_data) {
        await this.saveExtractedData(session.id, response.extracted_data);
      }

      return {
        message: response.message,
        extracted_data: response.extracted_data || {},
        conversation_state: response.conversation_state || 'collecting_info',
        is_data_complete: response.is_data_complete || false
      };
    } catch (error) {
      console.error('❌ Conversation service error:', error);
      return {
        message:
          "I'm having trouble processing that. Let's try a different approach. What grade are you in, and what subject is your test for?",
        extracted_data: {},
        conversation_state: 'error',
        is_data_complete: false
      };
    }
  }

  /**
   * Build system prompt for exam prep conversation
   */
  buildExamPrepSystemPrompt(user) {
    return `You are a supportive educational assistant helping a student prepare for an upcoming exam or test.

YOUR GOAL: Have a natural conversation to gather essential information while being supportive of any anxiety.

REQUIRED INFORMATION TO EXTRACT:
1. Grade level (10, 11, or university/varsity)
2. Subject (mathematics, physics, chemistry, etc.)
3. Specific topics they're struggling with
4. Date of the upcoming exam
5. Preferred time for daily study reminders

CONVERSATION APPROACH:
- Be warm, encouraging and use a supportive tone
- Extract information conversationally, not as an interrogation
- Acknowledge any stress or anxiety expressed
- If information is missing, ask for it naturally
- South African context: Use "maths" not "math", and be familiar with matric system

RESPONSE FORMAT:
Always respond with valid JSON containing:
{
  "message": "Your natural conversational response to the student",
  "extracted_data": {
    "grade": "detected grade or null",
    "subject": "detected subject or null",
    "topics": ["array of specific topics mentioned or empty array"],
    "exam_date": "detected date in YYYY-MM-DD format or null",
    "preferred_time": "detected time or null"
  },
  "conversation_state": "collecting_info|offering_plan|confirming_details",
  "is_data_complete": boolean indicating if all required data is collected
}

After collecting all required information, transition to offering a study plan with daily lessons and practice.`;
  }

  /**
   * Get conversation history for a session
   */
  async getConversationHistory(sessionId) {
    return executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('conversation_history')
        .select('messages')
        .eq('session_id', sessionId)
        .single();

      if (error || !data) {
        console.log(`Creating new conversation history for session ${sessionId}`);
        return [];
      }

      return data.messages || [];
    });
  }

  /**
   * Save conversation history for a session
   */
  async saveConversationHistory(sessionId, messages) {
    return executeQuery(async (supabase) => {
      const { data: existing } = await supabase
        .from('conversation_history')
        .select('id')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('conversation_history')
          .update({
            messages,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('conversation_history').insert({
          session_id: sessionId,
          messages,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Save extracted data to session
   */
  async saveExtractedData(sessionId, extractedData) {
    return executeQuery(async (supabase) => {
      const updates = {};

      if (extractedData.grade) updates.user_grade = extractedData.grade;
      if (extractedData.subject) updates.focus_subject = extractedData.subject;
      if (extractedData.topics && extractedData.topics.length > 0) {
        updates.focus_topics = extractedData.topics;
      }
      if (extractedData.exam_date) updates.exam_date = extractedData.exam_date;
      if (extractedData.preferred_time) updates.preferred_time = extractedData.preferred_time;

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('exam_prep_sessions')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId);
      }
    });
  }
}

export const conversationService = new ConversationService();

