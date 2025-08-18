/**
 * AI Tutor Handler
 * Date: 2025-08-18 12:08:29 UTC
 * Author: sophoniagoat
 *
 * Handles AI tutor conversations and interactions
 */

import { executeQuery } from '../config/database.js';
import { updateUser } from '../services/userService.js';
import { aiTutorService } from '../services/aiTutorService.js';
import { MESSAGES } from '../config/constants.js';

export const aiTutorHandler = {
  /**
   * Start a tutoring session
   *
   * @param {Object} user - User object
   * @param {Object} parameters - Tutoring parameters
   * @returns {string} Initial tutor message
   */
  async startTutoring(user, parameters = {}) {
    try {
      console.log(`🧠 Starting AI tutoring for user ${user.id}`);

      // Create new tutoring context
      const tutorContext = {
        subject: parameters.subject || 'math',
        topic: parameters.topic || null,
        questionContext: parameters.questionContext || null,
        lessonContext: parameters.lessonContext || null,
        grade: user.grade || parameters.grade || 10,
        sessionId: parameters.sessionId || null,
        studyPlanId: parameters.studyPlanId || null,
        startMode: parameters.startMode || 'general'
      };

      // Generate appropriate welcome message based on context
      let welcomeMessage = '';

      if (tutorContext.startMode === 'question_help' && tutorContext.questionContext) {
        welcomeMessage = `I see you're working on a question about ${tutorContext.topic || 'mathematics'}. How can I help you with this problem?`;
      } else if (tutorContext.startMode === 'lesson_followup' && tutorContext.lessonContext) {
        welcomeMessage = `You've just learned about ${tutorContext.lessonContext}. Do you have any questions about this topic that I can help with?`;
      } else if (tutorContext.topic) {
        welcomeMessage = `I'm ready to help you with ${tutorContext.topic}! What specific question do you have?`;
      } else {
        welcomeMessage = `Hi there! I'm your math tutor. What would you like help with today?`;
      }

      // Get tutor response for welcome message
      const tutorResponse = await aiTutorService.getTutorResponse(
        user,
        welcomeMessage,
        tutorContext
      );

      // Update user state
      await updateUser(user.id, {
        current_menu: 'tutor_active',
        tutor_context: JSON.stringify(tutorResponse.context),
        last_active_at: new Date().toISOString()
      });

      // Get suggestion chips
      const suggestions = await aiTutorService.getTutorSuggestions(user);
      const suggestionText =
        suggestions.length > 0
          ? `\n\n*You can ask me things like:*\n• ${suggestions.join('\n• ')}`
          : '';

      return tutorResponse.message + suggestionText;
    } catch (error) {
      console.error('❌ Tutoring start error:', error);
      return `I'm having trouble connecting to the AI tutor. Please try again or type "menu" to return to the main menu.`;
    }
  },

  /**
   * Handle tutoring conversation message
   *
   * @param {Object} user - User object
   * @param {string} message - User message
   * @returns {Object} Response object
   */
  async handleTutoringMessage(user, message) {
    try {
      console.log(
        `💬 Processing tutor message from user ${user.id}: "${message.substring(0, 30)}..."`
      );

      // Parse tutoring context
      let tutorContext = {};
      try {
        tutorContext = user.tutor_context ? JSON.parse(user.tutor_context) : {};
      } catch (e) {
        console.error('❌ Context parsing error:', e);
        tutorContext = {};
      }

      // Check for ending commands
      if (
        message.toLowerCase() === 'end tutoring' ||
        message.toLowerCase() === 'exit' ||
        message.toLowerCase() === 'menu'
      ) {
        return await this.endTutoring(user, tutorContext);
      }

      // Check for request to switch topics
      if (
        message.toLowerCase().startsWith('help with ') ||
        message.toLowerCase().startsWith('switch to ')
      ) {
        const newTopic = message.split(' ').slice(2).join(' ');
        tutorContext.topic = newTopic;
      }

      // Get tutor response
      const tutorResponse = await aiTutorService.getTutorResponse(user, message, tutorContext);

      // Update user state
      await updateUser(user.id, {
        tutor_context: JSON.stringify(tutorResponse.context),
        last_active_at: new Date().toISOString()
      });

      return {
        message: tutorResponse.message,
        nextState: 'tutor_active'
      };
    } catch (error) {
      console.error('❌ Tutoring message error:', error);
      return {
        message: `I'm having trouble processing your message. Please try rephrasing, or type "menu" to exit the tutoring session.`,
        nextState: 'tutor_active'
      };
    }
  },

  /**
   * End tutoring session
   *
   * @param {Object} user - User object
   * @param {Object} context - Tutoring context
   * @returns {Object} Response object
   */
  async endTutoring(user, context) {
    try {
      // Record tutoring session end
      if (context.conversationId) {
        await executeQuery(async (supabase) => {
          await supabase
            .from('tutor_conversations')
            .update({
              ended_at: new Date().toISOString(),
              duration_minutes: this.calculateSessionDuration(context),
              updated_at: new Date().toISOString()
            })
            .eq('id', context.conversationId);
        });
      }

      // Update user state
      await updateUser(user.id, {
        current_menu: 'welcome',
        tutor_context: null,
        last_active_at: new Date().toISOString()
      });

      return {
        message: `Thanks for using the AI Tutor! I hope you found our session helpful.\n\n${MESSAGES.WELCOME.MAIN_MENU}`,
        nextState: 'welcome'
      };
    } catch (error) {
      console.error('❌ Tutoring end error:', error);
      return {
        message: `Your tutoring session has ended. ${MESSAGES.WELCOME.MAIN_MENU}`,
        nextState: 'welcome'
      };
    }
  },

  /**
   * Calculate tutoring session duration in minutes
   *
   * @param {Object} context - Tutoring context
   * @returns {number} Duration in minutes
   */
  calculateSessionDuration(context) {
    if (!context.startedAt) return 0;

    const startTime = new Date(context.startedAt).getTime();
    const endTime = Date.now();
    const durationMs = endTime - startTime;

    return Math.round(durationMs / (1000 * 60));
  },

  /**
   * Get tutoring topics for selection
   *
   * @param {Object} user - User object
   * @returns {Array} Available topics
   */
  async getTutoringTopics(user) {
    // Get user's grade
    const grade = user.grade || 10;

    // Base topics available at all grade levels
    const baseTopics = ['Algebra', 'Geometry', 'Trigonometry', 'Functions', 'Statistics'];

    // Grade-specific topics
    const gradeTopics = {
      10: ['Linear Equations', 'Quadratic Equations', 'Coordinate Geometry'],
      11: ['Calculus', 'Vectors', 'Probability'],
      12: ['Calculus', 'Matrices', 'Complex Numbers']
    };

    // Combine base topics with grade-specific ones
    let availableTopics = [...baseTopics];

    if (gradeTopics[grade]) {
      availableTopics = [...availableTopics, ...gradeTopics[grade]];
    }

    // Get recently practiced topics
    const recentTopics = await executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('topic_performance')
        .select('topic')
        .eq('user_id', user.id)
        .order('last_practiced_at', { ascending: false })
        .limit(3);

      if (error || !data) {
        return [];
      }

      return data.map((d) => d.topic);
    });

    // Add recent topics at the beginning if not already included
    recentTopics.forEach((topic) => {
      if (!availableTopics.includes(topic)) {
        availableTopics.unshift(topic);
      }
    });

    return availableTopics;
  },

  /**
   * Handle topic selection for tutoring
   *
   * @param {Object} user - User object
   * @param {string} topic - Selected topic
   * @returns {Object} Response object
   */
  async handleTopicSelection(user, topic) {
    try {
      // Start tutoring with selected topic
      const tutorStart = await this.startTutoring(user, {
        topic: topic,
        startMode: 'topic_specific'
      });

      return {
        message: tutorStart,
        nextState: 'tutor_active'
      };
    } catch (error) {
      console.error('❌ Topic selection error:', error);
      return {
        message:
          `I'm having trouble with that topic. Let's start with general math help instead.\n\n` +
          (await this.startTutoring(user)),
        nextState: 'tutor_active'
      };
    }
  }
};


