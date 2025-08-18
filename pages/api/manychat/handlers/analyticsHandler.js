/**
 * Analytics Handler
 * Date: 2025-08-18 12:28:45 UTC
 * Author: sophoniagoat
 *
 * Handles analytics and reporting requests
 */

import { executeQuery } from '../config/database.js';
import { updateUser } from '../services/userService.js';
import { analyticsService } from '../services/analyticsService.js';
import { MESSAGES } from '../config/constants.js';
import { practiceHandler } from './practiceHandler.js';

export const analyticsHandler = {
  /**
   * Show progress summary
   *
   * @param {Object} user - User object
   * @returns {string} Formatted progress summary
   */
  async showProgressSummary(user) {
    try {
      console.log(`📊 Showing progress summary for user ${user.id}`);

      // Get user progress summary
      const progressSummary = await analyticsService.getUserProgressSummary(user.id, {
        daysLookback: 14, // Show last 2 weeks
        includeTopics: true,
        includeUpcomingExam: true
      });

      // Format for display
      const formattedSummary = analyticsService.formatProgressSummary(progressSummary);

      // Update user state
      await updateUser(user.id, {
        current_menu: 'progress_summary',
        analytics_context: JSON.stringify({
          summaryDate: new Date().toISOString(),
          summaryType: 'progress',
          topics: progressSummary.topic_performance?.map((t) => t.topic) || []
        }),
        last_active_at: new Date().toISOString()
      });

      return formattedSummary;
    } catch (error) {
      console.error('❌ Progress summary error:', error);
      return `I'm having trouble generating your progress summary right now. Please try again later.`;
    }
  },

  /**
   * Handle progress summary interaction
   *
   * @param {Object} user - User object
   * @param {string} command - User command
   * @returns {Object} Response object
   */
  async handleProgressInteraction(user, command) {
    try {
      console.log(`📊 Progress interaction: ${command} from user ${user.id}`);

      // Parse analytics context
      let analyticsContext = {};
      try {
        analyticsContext = user.analytics_context ? JSON.parse(user.analytics_context) : {};
      } catch (e) {
        console.error('❌ Context parsing error:', e);
        analyticsContext = {};
      }

      // Process specific commands
      switch (command.toLowerCase()) {
        case 'details':
          return await this.showTopicsList(user, analyticsContext);

        case 'practice':
          return await this.startPracticeFromSummary(user, analyticsContext);

        case 'dashboard':
          return await this.showDashboardLink(user);

        case 'refresh':
          // Generate fresh summary
          const newSummary = await this.showProgressSummary(user);
          return {
            message: newSummary,
            nextState: 'progress_summary'
          };

        case 'menu':
          // Return to main menu
          return {
            message: MESSAGES.WELCOME.MAIN_MENU,
            nextState: 'welcome'
          };

        default:
          // Check if user is selecting a topic from the list
          if (analyticsContext.summaryType === 'topic_list') {
            const topics = analyticsContext.topics || [];
            const topicIndex = parseInt(command) - 1;

            if (!isNaN(topicIndex) && topicIndex >= 0 && topicIndex < topics.length) {
              return await this.showTopicReport(user, topics[topicIndex]);
            }
          }

          // Check if command starts with "topic"
          if (command.toLowerCase().startsWith('topic ')) {
            const topic = command.substring(6).trim();
            return await this.showTopicReport(user, topic);
          }

          // Unrecognized command
          return {
            message: `To continue, you can:\n• Type "details" to see topic details\n• Type "practice" to start practicing\n• Type "dashboard" to access your web dashboard\n• Type "menu" to return to the main menu`,
            nextState: 'progress_summary'
          };
      }
    } catch (error) {
      console.error('❌ Progress interaction error:', error);
      return {
        message: `I'm having trouble processing that command. Type "menu" to return to the main menu.`,
        nextState: 'welcome'
      };
    }
  },

  /**
   * Show list of topics for detailed reports
   *
   * @param {Object} user - User object
   * @param {Object} context - Analytics context
   * @returns {Object} Response object
   */
  async showTopicsList(user, context) {
    try {
      // Get topics from context or fetch them
      let topics = context.topics || [];

      if (topics.length === 0) {
        // Get topic performance to build list
        const topicPerformance = await executeQuery(async (supabase) => {
          const { data, error } = await supabase
            .from('topic_performance')
            .select('topic')
            .eq('user_id', user.id)
            .order('last_practiced_at', { ascending: false });

          if (error) {
            console.error('❌ Topic list fetch error:', error);
            return [];
          }

          return data?.map((tp) => tp.topic) || [];
        });

        topics = topicPerformance;
      }

      if (topics.length === 0) {
        return {
          message: `You haven't completed enough practice in specific topics yet. Keep practicing to see detailed topic reports!`,
          nextState: 'progress_summary'
        };
      }

      // Build topic list message
      let message = `📋 **SELECT A TOPIC FOR DETAILED REPORT**\n\n`;

      topics.forEach((topic, index) => {
        message += `${index + 1}. ${topic}\n`;
      });

      message += `\nReply with the number of the topic you want to view, or type "menu" to return to the main menu.`;

      // Update context
      await updateUser(user.id, {
        analytics_context: JSON.stringify({
          ...context,
          summaryType: 'topic_list',
          topics
        }),
        last_active_at: new Date().toISOString()
      });

      return {
        message,
        nextState: 'progress_summary'
      };
    } catch (error) {
      console.error('❌ Topics list error:', error);
      return {
        message: `I'm having trouble fetching your topic list. Please try again later or type "menu" to return to the main menu.`,
        nextState: 'progress_summary'
      };
    }
  },

  /**
   * Show detailed topic report
   *
   * @param {Object} user - User object
   * @param {string} topic - Topic name
   * @returns {Object} Response object
   */
  async showTopicReport(user, topic) {
    try {
      console.log(`📊 Showing topic report for user ${user.id}, topic ${topic}`);

      // Get topic report
      const topicReport = await analyticsService.getTopicReport(user.id, topic);

      // Format for display
      const formattedReport = analyticsService.formatTopicReport(topicReport);

      // Update context
      await updateUser(user.id, {
        analytics_context: JSON.stringify({
          summaryType: 'topic_report',
          currentTopic: topic,
          reportDate: new Date().toISOString()
        }),
        last_active_at: new Date().toISOString()
      });

      return {
        message: formattedReport,
        nextState: 'topic_report'
      };
    } catch (error) {
      console.error('❌ Topic report error:', error);
      return {
        message: `I'm having trouble generating a detailed report for ${topic}. Please try again later or type "menu" to return to the main menu.`,
        nextState: 'progress_summary'
      };
    }
  },

  /**
   * Handle topic report interaction
   *
   * @param {Object} user - User object
   * @param {string} command - User command
   * @returns {Object} Response object
   */
  async handleTopicReportInteraction(user, command) {
    try {
      console.log(`📊 Topic report interaction: ${command} from user ${user.id}`);

      // Parse analytics context
      let analyticsContext = {};
      try {
        analyticsContext = user.analytics_context ? JSON.parse(user.analytics_context) : {};
      } catch (e) {
        console.error('❌ Context parsing error:', e);
        analyticsContext = {};
      }

      const currentTopic = analyticsContext.currentTopic;

      // Process specific commands
      switch (command.toLowerCase()) {
        case 'back':
          // Go back to progress summary
          return {
            message: await this.showProgressSummary(user),
            nextState: 'progress_summary'
          };

        case 'practice':
          // Start practice on this topic
          if (currentTopic) {
            return await this.startTopicPractice(user, currentTopic);
          } else {
            return await this.startPracticeFromSummary(user, analyticsContext);
          }

        case 'menu':
          // Return to main menu
          return {
            message: MESSAGES.WELCOME.MAIN_MENU,
            nextState: 'welcome'
          };

        default:
          // Check if command starts with "practice"
          if (command.toLowerCase().startsWith('practice ')) {
            const topic = command.substring(9).trim();
            return await this.startTopicPractice(user, topic);
          }

          // Unrecognized command
          return {
            message: `To continue, you can:\n• Type "practice ${currentTopic || 'topic'}" to practice this topic\n• Type "back" to return to your progress summary\n• Type "menu" to return to the main menu`,
            nextState: 'topic_report'
          };
      }
    } catch (error) {
      console.error('❌ Topic report interaction error:', error);
      return {
        message: `I'm having trouble processing that command. Type "menu" to return to the main menu.`,
        nextState: 'welcome'
      };
    }
  },

  /**
   * Start practice from progress summary
   *
   * @param {Object} user - User object
   * @param {Object} context - Analytics context
   * @returns {Object} Response object
   */
  async startPracticeFromSummary(user, context) {
    try {
      // Get topics from context
      const topics = context.topics || [];

      // If user has topics, suggest one to practice
      if (topics.length > 0) {
        // Get recommended topic based on performance
        const topicPerformance = await executeQuery(async (supabase) => {
          const { data, error } = await supabase
            .from('topic_performance')
            .select('*')
            .eq('user_id', user.id)
            .order('average_understanding', { ascending: true }) // Focus on lowest understanding
            .limit(3);

          if (error) {
            console.error('❌ Topic performance fetch error:', error);
            return [];
          }

          return data || [];
        });

        // If we have performance data, recommend weakest topic
        if (topicPerformance.length > 0) {
          const recommendedTopic = topicPerformance[0].topic;

          // Start practice with recommended topic
          const practiceStart = await practiceHandler.startPractice(user, {
            topic: recommendedTopic
          });

          return {
            message: `Based on your progress, I recommend practicing ${recommendedTopic}.\n\n${practiceStart}`,
            nextState: 'practice_active'
          };
        }

        // Otherwise just use the first topic from context
        const practiceStart = await practiceHandler.startPractice(user, {
          topic: topics[0]
        });

        return {
          message: practiceStart,
          nextState: 'practice_active'
        };
      }

      // If no topics available, start general practice
      const practiceStart = await practiceHandler.startPractice(user);

      return {
        message: practiceStart,
        nextState: 'practice_active'
      };
    } catch (error) {
      console.error('❌ Practice start error:', error);
      return {
        message: `I'm having trouble starting practice. Please try again or type "menu" to return to the main menu.`,
        nextState: 'progress_summary'
      };
    }
  },

  /**
   * Start practice on a specific topic
   *
   * @param {Object} user - User object
   * @param {string} topic - Topic name
   * @returns {Object} Response object
   */
  async startTopicPractice(user, topic) {
    try {
      console.log(`🧮 Starting topic practice for user ${user.id}, topic ${topic}`);

      // Start practice with this topic
      const practiceStart = await practiceHandler.startPractice(user, {
        topic: topic
      });

      return {
        message: practiceStart,
        nextState: 'practice_active'
      };
    } catch (error) {
      console.error('❌ Topic practice error:', error);
      return {
        message: `I'm having trouble starting practice for ${topic}. Please try again or type "menu" to return to the main menu.`,
        nextState: 'topic_report'
      };
    }
  },

  /**
   * Show dashboard link
   *
   * @param {Object} user - User object
   * @returns {Object} Response object
   */
  async showDashboardLink(user) {
    try {
      // Get dashboard URL
      const dashboardUrl = await analyticsService.getDashboardUrl(user.id);

      return {
        message:
          `📱 **ACCESS YOUR WEB DASHBOARD**\n\n` +
          `For more detailed analytics and visualizations, visit your personal dashboard:\n\n` +
          `${dashboardUrl}\n\n` +
          `Your dashboard includes:\n` +
          `• Interactive progress charts\n` +
          `• Detailed topic breakdowns\n` +
          `• Study time analytics\n` +
          `• Performance predictions\n\n` +
          `Type "back" to return to your progress summary.`,
        nextState: 'progress_summary'
      };
    } catch (error) {
      console.error('❌ Dashboard link error:', error);
      return {
        message: `I'm having trouble generating your dashboard link. Please try again later or type "menu" to return to the main menu.`,
        nextState: 'progress_summary'
      };
    }
  }
};
