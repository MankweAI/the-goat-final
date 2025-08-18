/**
 * AI Tutor Service
 * Date: 2025-08-18 12:08:29 UTC
 * Author: sophoniagoat
 *
 * Provides AI-powered tutoring for personalized student support
 */

import { getOpenAIClient, OPENAI_CONFIG } from '../config/openai.js';
import { executeQuery } from '../config/database.js';

export class AITutorService {
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
   * Start or continue a tutoring conversation
   *
   * @param {Object} user - User object
   * @param {string} userMessage - User's question or message
   * @param {Object} context - Tutoring context
   * @returns {Object} Tutor response
   */
  async getTutorResponse(user, userMessage, context = {}) {
    try {
      console.log(`🤖 Processing tutor request from user ${user.id}`);

      // Initialize conversation if new
      if (!context.conversationId) {
        context = await this.initializeConversation(user, context);
      }

      // Retrieve conversation history
      const conversationHistory = await this.getConversationHistory(context.conversationId);

      // Determine context type and build system prompt
      const systemPrompt = await this.buildTutorSystemPrompt(user, context);

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
        max_tokens: 800,
        temperature: 0.7
      });

      const tutorResponse = completion.choices[0].message.content;

      // Add assistant response to history
      conversationHistory.push({
        role: 'assistant',
        content: tutorResponse
      });

      // Save conversation history
      await this.saveConversationHistory(context.conversationId, conversationHistory);

      // Extract insights if appropriate
      const insights = await this.extractInsightsFromConversation(
        user.id,
        context.conversationId,
        conversationHistory.slice(-5)
      );

      return {
        message: tutorResponse,
        context: {
          ...context,
          lastResponseTimestamp: new Date().toISOString(),
          insights
        }
      };
    } catch (error) {
      console.error('❌ AI Tutor error:', error);
      return {
        message:
          "I'm having trouble connecting to the tutor right now. Could you rephrase your question or try again in a moment?",
        context: context
      };
    }
  }

  /**
   * Initialize a new tutoring conversation
   *
   * @param {Object} user - User object
   * @param {Object} initialContext - Initial context data
   * @returns {Object} Updated context with conversation ID
   */
  async initializeConversation(user, initialContext = {}) {
    // Create conversation record
    const conversationId = await executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('tutor_conversations')
        .insert({
          user_id: user.id,
          subject: initialContext.subject || 'math',
          topic: initialContext.topic || null,
          grade_level: user.grade || initialContext.grade || 10,
          session_id: initialContext.sessionId || null,
          study_plan_id: initialContext.studyPlanId || null,
          conversation_data: initialContext,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        console.error('❌ Conversation initialization error:', error);
        throw error;
      }

      return data.id;
    });

    // Create empty conversation history
    await this.saveConversationHistory(conversationId, []);

    // Return updated context
    return {
      ...initialContext,
      conversationId,
      startedAt: new Date().toISOString()
    };
  }

  /**
   * Get conversation history for a tutor conversation
   *
   * @param {string} conversationId - Conversation ID
   * @returns {Array} Conversation messages
   */
  async getConversationHistory(conversationId) {
    return executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('tutor_conversation_history')
        .select('messages')
        .eq('conversation_id', conversationId)
        .single();

      if (error || !data) {
        console.log(`Creating new conversation history for conversation ${conversationId}`);
        return [];
      }

      return data.messages || [];
    });
  }

  /**
   * Save conversation history
   *
   * @param {string} conversationId - Conversation ID
   * @param {Array} messages - Conversation messages
   * @returns {boolean} Success status
   */
  async saveConversationHistory(conversationId, messages) {
    return executeQuery(async (supabase) => {
      const { data: existing } = await supabase
        .from('tutor_conversation_history')
        .select('id')
        .eq('conversation_id', conversationId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('tutor_conversation_history')
          .update({
            messages,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('tutor_conversation_history').insert({
          conversation_id: conversationId,
          messages,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      // Update conversation last activity timestamp
      await supabase
        .from('tutor_conversations')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);
    });
  }

  /**
   * Build system prompt for tutor based on context
   *
   * @param {Object} user - User object
   * @param {Object} context - Tutoring context
   * @returns {string} System prompt
   */
  async buildTutorSystemPrompt(user, context) {
    // Get user grade level
    const gradeLevel = user.grade || context.grade || 10;

    // Get subject and topic
    const subject = context.subject || 'math';
    const topic = context.topic || null;

    // Get user performance data if available
    const performanceData = await this.getUserPerformanceData(user.id, topic);

    // Base prompt
    let prompt = `You are a supportive and encouraging math tutor for a grade ${gradeLevel} student.

YOUR GOAL: Help the student understand mathematical concepts deeply and solve problems on their own.

TUTORING APPROACH:
- Use Socratic questioning to guide students towards answers
- Provide clear, step-by-step explanations using simple language
- Break down complex problems into manageable parts
- Relate concepts to everyday examples where possible
- Be encouraging and patient
- Avoid simply giving answers; help students discover them

MATHEMATICAL LANGUAGE:
- Explain mathematical terms clearly
- Use proper notation but explain what the symbols mean
- When using formulas, explain why they work, not just how

RESPONSE STYLE:
- Keep explanations concise (2-4 paragraphs at most)
- Use numbered steps for procedures
- For difficult concepts, use analogies
- Tailor explanations to grade ${gradeLevel} level
- Be conversational and friendly
- Ask check-in questions to ensure understanding`;

    // Add subject/topic specific instructions
    if (topic) {
      prompt += `\n\nYou are currently helping with ${subject} - ${topic}.`;
    } else {
      prompt += `\n\nYou are currently helping with ${subject}.`;
    }

    // Add student background based on performance data
    if (performanceData) {
      if (performanceData.strengths && performanceData.strengths.length > 0) {
        prompt += `\n\nThe student shows strengths in: ${performanceData.strengths.join(', ')}.`;
      }

      if (performanceData.weaknesses && performanceData.weaknesses.length > 0) {
        prompt += `\n\nAreas where the student needs more support: ${performanceData.weaknesses.join(', ')}.`;
      }

      if (
        performanceData.recent_misconceptions &&
        performanceData.recent_misconceptions.length > 0
      ) {
        prompt += `\n\nRecent misconceptions to address: ${performanceData.recent_misconceptions.join(', ')}.`;
      }
    }

    // Add context-specific instructions
    if (context.questionContext) {
      prompt += `\n\nThe student is currently working on this specific question: "${context.questionContext}"`;
    }

    if (context.lessonContext) {
      prompt += `\n\nThe student has just completed a lesson on: "${context.lessonContext}"`;
    }

    // Add reminder about maintaining style
    prompt += `\n\nIMPORTANT: Remember that you're communicating via WhatsApp. Keep responses concise and well-structured. Use simple formatting like numbering, bullet points, and occasional emphasis.`;

    return prompt;
  }

  /**
   * Get user performance data for personalized tutoring
   *
   * @param {string} userId - User ID
   * @param {string} topic - Current topic (optional)
   * @returns {Object} Performance data
   */
  async getUserPerformanceData(userId, topic = null) {
    try {
      // Get topic performance data
      const topicPerformance = await executeQuery(async (supabase) => {
        let query = supabase.from('topic_performance').select('*').eq('user_id', userId);

        if (topic) {
          query = query.eq('topic', topic);
        }

        const { data, error } = await query
          .order('last_practiced_at', { ascending: false })
          .limit(topic ? 1 : 5);

        if (error) {
          console.error('❌ Topic performance fetch error:', error);
          return [];
        }

        return data || [];
      });

      if (topicPerformance.length === 0) {
        return null;
      }

      // Get recent practice attempts to identify misconceptions
      const recentAttempts = await executeQuery(async (supabase) => {
        const { data, error } = await supabase
          .from('practice_attempts')
          .select('misconceptions')
          .eq('user_id', userId)
          .not('misconceptions', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(10);

        if (error) {
          console.error('❌ Recent attempts fetch error:', error);
          return [];
        }

        return data || [];
      });

      // Extract strengths and weaknesses
      let strengths = [];
      let weaknesses = [];

      topicPerformance.forEach((perf) => {
        if (perf.strengths) strengths = [...strengths, ...perf.strengths];
        if (perf.weaknesses) weaknesses = [...weaknesses, ...perf.weaknesses];
      });

      // Remove duplicates
      strengths = [...new Set(strengths)];
      weaknesses = [...new Set(weaknesses)];

      // Extract recent misconceptions
      const recentMisconceptions = [];
      recentAttempts.forEach((attempt) => {
        if (attempt.misconceptions) {
          recentMisconceptions.push(...attempt.misconceptions);
        }
      });

      return {
        strengths: strengths.slice(0, 5),
        weaknesses: weaknesses.slice(0, 5),
        recent_misconceptions: [...new Set(recentMisconceptions)].slice(0, 5),
        average_understanding: topicPerformance[0]?.average_understanding || null,
        attempts_count: topicPerformance.reduce((sum, tp) => sum + (tp.attempts_count || 0), 0)
      };
    } catch (error) {
      console.error('❌ Performance data fetch error:', error);
      return null;
    }
  }

  /**
   * Extract insights from conversation
   *
   * @param {string} userId - User ID
   * @param {string} conversationId - Conversation ID
   * @param {Array} recentMessages - Recent conversation messages
   * @returns {Object} Extracted insights
   */
  async extractInsightsFromConversation(userId, conversationId, recentMessages) {
    try {
      // Only run analysis periodically or for significant conversations
      if (recentMessages.length < 4) {
        return null;
      }

      // Check if we've recently analyzed this conversation
      const recentAnalysis = await executeQuery(async (supabase) => {
        const { data, error } = await supabase
          .from('tutor_insights')
          .select('created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error || !data) {
          return null;
        }

        const timeSinceAnalysis = Date.now() - new Date(data.created_at).getTime();
        // If analyzed in the last 10 minutes, skip
        if (timeSinceAnalysis < 10 * 60 * 1000) {
          return data;
        }

        return null;
      });

      if (recentAnalysis) {
        return null;
      }

      // Format conversation for analysis
      const conversationText = recentMessages
        .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join('\n\n');

      // Call GPT for insight extraction
      const client = await this.getClient();
      const completion = await client.chat.completions.create({
        model: OPENAI_CONFIG.MODEL,
        messages: [
          {
            role: 'system',
            content: `You are an educational analyst who extracts insights from tutoring conversations.
            
Your task is to analyze a math tutoring conversation and extract:
1. Topics discussed
2. Concepts the student understands well
3. Concepts the student struggles with
4. Specific misconceptions demonstrated
5. Learning style preferences shown

Respond with a JSON object containing these insights. Be specific and concise.`
          },
          { role: 'user', content: conversationText }
        ],
        max_tokens: 500,
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      // Parse insights
      const insights = JSON.parse(completion.choices[0].message.content);

      // Save insights to database
      await this.saveConversationInsights(userId, conversationId, insights);

      return insights;
    } catch (error) {
      console.error('❌ Insight extraction error:', error);
      return null;
    }
  }

  /**
   * Save conversation insights to database
   *
   * @param {string} userId - User ID
   * @param {string} conversationId - Conversation ID
   * @param {Object} insights - Extracted insights
   * @returns {boolean} Success status
   */
  async saveConversationInsights(userId, conversationId, insights) {
    return executeQuery(async (supabase) => {
      // Save to tutor_insights table
      const { error } = await supabase.from('tutor_insights').insert({
        user_id: userId,
        conversation_id: conversationId,
        topics_discussed: insights.topics || [],
        strengths_identified: insights.concepts_understood || [],
        weaknesses_identified: insights.concepts_struggled_with || [],
        misconceptions: insights.misconceptions || [],
        learning_preferences: insights.learning_style_preferences || [],
        created_at: new Date().toISOString()
      });

      if (error) {
        console.error('❌ Insights save error:', error);
        return false;
      }

      // Update topic performance if topics were discussed
      if (insights.topics && insights.topics.length > 0) {
        const mainTopic = insights.topics[0];

        // Check if topic performance record exists
        const { data: existingPerformance } = await supabase
          .from('topic_performance')
          .select('id, strengths, weaknesses')
          .eq('user_id', userId)
          .eq('topic', mainTopic)
          .maybeSingle();

        if (existingPerformance) {
          // Update existing record
          const updatedStrengths = [
            ...new Set([
              ...(existingPerformance.strengths || []),
              ...(insights.concepts_understood || [])
            ])
          ];

          const updatedWeaknesses = [
            ...new Set([
              ...(existingPerformance.weaknesses || []),
              ...(insights.concepts_struggled_with || [])
            ])
          ];

          await supabase
            .from('topic_performance')
            .update({
              strengths: updatedStrengths,
              weaknesses: updatedWeaknesses,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingPerformance.id);
        } else {
          // Create new record
          await supabase.from('topic_performance').insert({
            user_id: userId,
            topic: mainTopic,
            strengths: insights.concepts_understood || [],
            weaknesses: insights.concepts_struggled_with || [],
            last_practiced_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      }

      return true;
    });
  }

  /**
   * Get available tutor suggestions based on context
   *
   * @param {Object} user - User object
   * @returns {Array} Available tutor suggestions
   */
  async getTutorSuggestions(user) {
    try {
      // Get user's recent activity
      const recentActivity = await this.getUserRecentActivity(user.id);

      // Base suggestions always available
      const suggestions = [
        'Help me with a math problem',
        'Explain a concept',
        'Practice suggestions'
      ];

      // Add topic-specific suggestions based on recent activity
      if (recentActivity.recent_topics && recentActivity.recent_topics.length > 0) {
        const topic = recentActivity.recent_topics[0];
        suggestions.push(`Help with ${topic}`);
      }

      // Add question-specific suggestions based on recent struggles
      if (recentActivity.recent_struggles && recentActivity.recent_struggles.length > 0) {
        const struggle = recentActivity.recent_struggles[0];
        suggestions.push(`I don't understand ${struggle}`);
      }

      // Add exam-specific suggestions
      if (recentActivity.upcoming_exam) {
        suggestions.push(`Help me prepare for my ${recentActivity.upcoming_exam.subject} test`);
      }

      return suggestions;
    } catch (error) {
      console.error('❌ Suggestions fetch error:', error);
      return ['Help me with a math problem', 'Explain a concept', 'Practice suggestions'];
    }
  }

  /**
   * Get user's recent activity for contextual suggestions
   *
   * @param {string} userId - User ID
   * @returns {Object} Recent activity data
   */
  async getUserRecentActivity(userId) {
    // Get recent lesson views
    const recentLessons = await executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('lesson_views')
        .select(
          `
          viewed_at,
          lessons (
            topic,
            subject
          )
        `
        )
        .eq('user_id', userId)
        .order('viewed_at', { ascending: false })
        .limit(3);

      if (error) {
        console.error('❌ Recent lessons fetch error:', error);
        return [];
      }

      return data || [];
    });

    // Get recent practice attempts
    const recentAttempts = await executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('practice_attempts')
        .select(
          `
          understanding_rating,
          completed_at,
          misconceptions,
          practice_questions (
            topic,
            subject
          )
        `
        )
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('❌ Recent attempts fetch error:', error);
        return [];
      }

      return data || [];
    });

    // Get active exam prep session
    const upcomingExam = await executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('exam_prep_sessions')
        .select('focus_subject, exam_date')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        return null;
      }

      return data;
    });

    // Extract recent topics
    const recentTopics = [];
    recentLessons.forEach((view) => {
      if (view.lessons && view.lessons.topic) {
        recentTopics.push(view.lessons.topic);
      }
    });

    recentAttempts.forEach((attempt) => {
      if (attempt.practice_questions && attempt.practice_questions.topic) {
        recentTopics.push(attempt.practice_questions.topic);
      }
    });

    // Extract recent struggles (low rating or misconceptions)
    const recentStruggles = [];

    recentAttempts.forEach((attempt) => {
      if (attempt.understanding_rating && attempt.understanding_rating <= 2) {
        if (attempt.practice_questions && attempt.practice_questions.topic) {
          recentStruggles.push(attempt.practice_questions.topic);
        }
      }

      if (attempt.misconceptions && attempt.misconceptions.length > 0) {
        recentStruggles.push(...attempt.misconceptions);
      }
    });

    return {
      recent_topics: [...new Set(recentTopics)],
      recent_struggles: [...new Set(recentStruggles)],
      upcoming_exam: upcomingExam
        ? {
            subject: upcomingExam.focus_subject,
            date: upcomingExam.exam_date
          }
        : null
    };
  }
}

export const aiTutorService = new AITutorService();

