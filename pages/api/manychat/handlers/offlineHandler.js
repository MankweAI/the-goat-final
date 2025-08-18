/**
 * Offline Mode Handler
 * Date: 2025-08-18 12:39:37 UTC
 * Author: sophoniagoat
 *
 * Handles offline mode interactions and low-connectivity scenarios
 */

import { executeQuery } from '../config/database.js';
import { updateUser } from '../services/userService.js';
import { offlineService } from '../services/offlineService.js';
import { MESSAGES } from '../config/constants.js';

export const offlineHandler = {
  /**
   * Handle request for offline package
   *
   * @param {Object} user - User object
   * @param {Object} options - Package options
   * @returns {string} Response message
   */
  async requestOfflinePackage(user, options = {}) {
    try {
      console.log(`📦 Offline package request from user ${user.id}`);

      // Check if user already has a valid package
      const existingPackage = await offlineService.getLatestOfflinePackage(user.id);

      if (existingPackage && !offlineService.packageNeedsUpdate(existingPackage)) {
        // Return existing package info
        return offlineService.formatOfflinePackageInfo(existingPackage);
      }

      // Generate new package
      const offlinePackage = await offlineService.generateOfflinePackage(user.id, options);

      if (!offlinePackage || offlinePackage.error) {
        return `I'm having trouble generating your offline package. Please try again later or ensure you have a good internet connection.`;
      }

      // Update user state
      await updateUser(user.id, {
        current_menu: 'offline_ready',
        offline_package_id: offlinePackage.package_id,
        last_active_at: new Date().toISOString()
      });

      // Return package info
      return offlineService.formatOfflinePackageInfo(offlinePackage);
    } catch (error) {
      console.error('❌ Offline package request error:', error);
      return `I'm having trouble preparing your offline content. Please try again or contact support if the problem persists.`;
    }
  },

  /**
   * Handle offline package interactions
   *
   * @param {Object} user - User object
   * @param {string} command - User command
   * @returns {Object} Response object
   */
  async handleOfflineInteraction(user, command) {
    try {
      console.log(`📦 Offline interaction: ${command} from user ${user.id}`);

      // Process specific commands
      switch (command.toLowerCase()) {
        case 'download':
          return await this.deliverOfflinePackage(user);

        case 'offline start':
          return await this.startOfflineMode(user);

        case 'sync':
          return {
            message:
              `To sync your offline progress, please send your progress data using the format:\n\n` +
              `{"type": "offline_sync", "data": { ... your progress data ... }}\n\n` +
              `If you're using the ExamPrep app, simply tap "Sync Progress" instead.`,
            nextState: 'offline_ready'
          };

        case 'menu':
          // Return to main menu
          return {
            message: MESSAGES.WELCOME.MAIN_MENU,
            nextState: 'welcome'
          };

        default:
          // Check if this is a sync data payload
          if (command.startsWith('{') && command.includes('"type":"offline_sync"')) {
            try {
              const syncData = JSON.parse(command);
              return await this.syncOfflineProgress(user, syncData.data);
            } catch (e) {
              return {
                message: `I couldn't process your sync data. Please try again or use the app's sync feature.`,
                nextState: 'offline_ready'
              };
            }
          }

          // Unrecognized command
          return {
            message:
              `To continue with offline mode, you can:\n` +
              `• Type "download" to get your offline package\n` +
              `• Type "offline start" to begin using offline content\n` +
              `• Type "sync" to update your progress\n` +
              `• Type "menu" to return to the main menu`,
            nextState: 'offline_ready'
          };
      }
    } catch (error) {
      console.error('❌ Offline interaction error:', error);
      return {
        message: `I'm having trouble processing that command. Type "menu" to return to the main menu.`,
        nextState: 'welcome'
      };
    }
  },

  /**
   * Deliver offline package to user
   *
   * @param {Object} user - User object
   * @returns {Object} Response object
   */
  async deliverOfflinePackage(user) {
    try {
      // Get user's latest package
      const offlinePackage = await offlineService.getLatestOfflinePackage(user.id);

      if (!offlinePackage) {
        return {
          message: `You don't have an offline package ready yet. Type "offline" to request one.`,
          nextState: 'welcome'
        };
      }

      // In a real implementation, this would send the package data
      // as a downloadable file or encoded message
      // For this demo, we'll just return a simulated link

      return {
        message:
          `📲 **YOUR OFFLINE PACKAGE**\n\n` +
          `Your offline package is ready! In a real implementation, this would:\n\n` +
          `1. Send a downloadable file via WhatsApp\n` +
          `2. Or provide a encoded data package\n` +
          `3. Or give a secure download link\n\n` +
          `Package size: ${offlinePackage.size_kb}KB\n` +
          `Expires: ${new Date(offlinePackage.expires_at).toDateString()}\n\n` +
          `Type "offline start" to begin using your offline content.`,
        nextState: 'offline_ready'
      };
    } catch (error) {
      console.error('❌ Package delivery error:', error);
      return {
        message: `I'm having trouble delivering your offline package. Please try again later or ensure you have a good internet connection.`,
        nextState: 'offline_ready'
      };
    }
  },

  /**
   * Start offline mode
   *
   * @param {Object} user - User object
   * @returns {Object} Response object
   */
  async startOfflineMode(user) {
    try {
      // In a real implementation, this would activate the offline mode
      // in the WhatsApp bot or client app

      return {
        message:
          `🔄 **OFFLINE MODE ACTIVATED**\n\n` +
          `You are now using offline mode. In a real implementation:\n\n` +
          `• You would now interact with locally stored content\n` +
          `• Your progress would be saved locally\n` +
          `• You could sync when back online\n\n` +
          `To simulate returning online, type "online".\n` +
          `To sync your offline progress, type "sync".`,
        nextState: 'offline_active'
      };
    } catch (error) {
      console.error('❌ Offline mode start error:', error);
      return {
        message: `I'm having trouble starting offline mode. Please try again or type "menu" to return to the main menu.`,
        nextState: 'offline_ready'
      };
    }
  },

  /**
   * Handle offline mode active state
   *
   * @param {Object} user - User object
   * @param {string} command - User command
   * @returns {Object} Response object
   */
  async handleOfflineActiveState(user, command) {
    try {
      console.log(`📱 Offline active command: ${command} from user ${user.id}`);

      // Process specific commands
      switch (command.toLowerCase()) {
        case 'online':
          // Return to online mode
          return {
            message:
              `✅ **ONLINE MODE RESTORED**\n\n` +
              `You're back in online mode! All features are now available.\n\n` +
              `Would you like to sync your offline progress?\n` +
              `• Type "sync" to update your progress\n` +
              `• Type "menu" to return to the main menu`,
            nextState: 'offline_ready'
          };

        case 'sync':
          return {
            message:
              `To sync your offline progress, please send your progress data using the format:\n\n` +
              `{"type": "offline_sync", "data": { ... your progress data ... }}\n\n` +
              `If you're using the ExamPrep app, simply tap "Sync Progress" instead.`,
            nextState: 'offline_active'
          };

        case 'lessons':
          // Simulate offline lessons list
          return {
            message: this.simulateOfflineLessonsList(user),
            nextState: 'offline_active'
          };

        case 'practice':
          // Simulate offline practice list
          return {
            message: this.simulateOfflinePracticeList(user),
            nextState: 'offline_active'
          };

        case 'plan':
          // Simulate offline study plan
          return {
            message: this.simulateOfflineStudyPlan(user),
            nextState: 'offline_active'
          };

        case 'menu':
          // Simulate offline menu
          return {
            message:
              `📱 **OFFLINE MENU**\n\n` +
              `Available offline options:\n` +
              `• Type "lessons" to view saved lessons\n` +
              `• Type "practice" to access practice questions\n` +
              `• Type "plan" to view your study plan\n` +
              `• Type "online" to return to online mode\n` +
              `• Type "sync" to sync progress when back online`,
            nextState: 'offline_active'
          };

        default:
          // Simulated offline response
          return {
            message:
              `You're currently in offline mode with limited functionality.\n\n` +
              `Type "menu" to see available offline options or "online" to return to online mode.`,
            nextState: 'offline_active'
          };
      }
    } catch (error) {
      console.error('❌ Offline active error:', error);
      return {
        message: `You're in offline mode. Type "online" to return to online mode or "menu" to see offline options.`,
        nextState: 'offline_active'
      };
    }
  },

  /**
   * Sync offline progress
   *
   * @param {Object} user - User object
   * @param {Object} progressData - Progress data
   * @returns {Object} Response object
   */
  async syncOfflineProgress(user, progressData) {
    try {
      console.log(`🔄 Syncing offline progress for user ${user.id}`);

      // Sync progress with server
      const syncResult = await offlineService.syncOfflineProgress(user.id, progressData);

      if (!syncResult.success) {
        return {
          message: `I couldn't sync your offline progress: ${syncResult.message}. Please try again later.`,
          nextState: user.current_menu
        };
      }

      // Progress synced successfully
      return {
        message:
          `✅ **PROGRESS SYNCED SUCCESSFULLY**\n\n` +
          `Your offline progress has been updated in our system. Here's what was synced:\n\n` +
          this.formatSyncSummary(progressData) +
          `\nType "menu" to return to the main menu or "offline" to update your offline package.`,
        nextState: 'welcome'
      };
    } catch (error) {
      console.error('❌ Progress sync error:', error);
      return {
        message: `I'm having trouble syncing your progress. Please try again later or contact support if the problem persists.`,
        nextState: user.current_menu
      };
    }
  },

  /**
   * Format sync summary
   *
   * @param {Object} progressData - Progress data
   * @returns {string} Formatted summary
   */
  formatSyncSummary(progressData) {
    let summary = '';

    if (progressData.completed_lessons) {
      summary += `📚 Lessons completed: ${progressData.completed_lessons.length}\n`;
    }

    if (progressData.practice_attempts) {
      summary += `🧮 Practice attempts: ${progressData.practice_attempts.length}\n`;
    }

    if (progressData.plan_progress && progressData.plan_progress.completed_days) {
      summary += `📅 Study plan days completed: ${progressData.plan_progress.completed_days.length}\n`;
    }

    if (summary === '') {
      summary = `No new progress data was synced.`;
    }

    return summary;
  },

  /**
   * Simulate offline lessons list
   *
   * @param {Object} user - User object
   * @returns {string} Simulated lessons list
   */
  simulateOfflineLessonsList(user) {
    return (
      `📚 **OFFLINE LESSONS**\n\n` +
      `The following lessons are available offline:\n\n` +
      `1. Linear Equations Fundamentals\n` +
      `2. Solving Quadratic Equations\n` +
      `3. Basic Trigonometric Ratios\n` +
      `4. Coordinate Geometry Basics\n` +
      `5. Probability Fundamentals\n\n` +
      `To view a lesson, you would type its number.\n` +
      `Type "menu" to return to the offline menu.`
    );
  },

  /**
   * Simulate offline practice list
   *
   * @param {Object} user - User object
   * @returns {string} Simulated practice list
   */
  simulateOfflinePracticeList(user) {
    return (
      `🧮 **OFFLINE PRACTICE**\n\n` +
      `The following practice sets are available offline:\n\n` +
      `1. Algebra (3 questions)\n` +
      `2. Geometry (2 questions)\n` +
      `3. Trigonometry (2 questions)\n` +
      `4. Mixed Review (3 questions)\n\n` +
      `To start practicing, you would type its number.\n` +
      `Type "menu" to return to the offline menu.`
    );
  },

  /**
   * Simulate offline study plan
   *
   * @param {Object} user - User object
   * @returns {string} Simulated study plan
   */
  simulateOfflineStudyPlan(user) {
    return (
      `📅 **OFFLINE STUDY PLAN**\n\n` +
      `Day 1: Algebra Focus\n` +
      `• Lesson: Linear Equations Fundamentals\n` +
      `• Practice: 2 algebra questions\n\n` +
      `Day 2: Geometry Focus\n` +
      `• Lesson: Coordinate Geometry Basics\n` +
      `• Practice: 2 geometry questions\n\n` +
      `Day 3: Mixed Review\n` +
      `• Lesson: Probability Fundamentals\n` +
      `• Practice: 3 mixed questions\n\n` +
      `To start a day's activities, you would type "day 1", "day 2", etc.\n` +
      `Type "menu" to return to the offline menu.`
    );
  },

  /**
   * Check for low connectivity and suggest offline mode
   *
   * @param {Object} user - User object
   * @param {Object} connectionData - Connection data
   * @returns {Object} Response with offline suggestion if needed
   */
  async checkConnectivityAndSuggestOffline(user, connectionData) {
    try {
      // Check if in low connectivity environment
      const isLowConnectivity = offlineService.isLowConnectivity(connectionData);

      if (!isLowConnectivity) {
        // Normal connectivity, no action needed
        return null;
      }

      console.log(`📡 Low connectivity detected for user ${user.id}`);

      // Check if user already has a valid offline package
      const existingPackage = await offlineService.getLatestOfflinePackage(user.id);

      if (existingPackage && !offlineService.packageNeedsUpdate(existingPackage)) {
        // Suggest using existing package
        return {
          message:
            `📡 **LOW CONNECTIVITY DETECTED**\n\n` +
            `You appear to be in an area with poor internet connection. Would you like to switch to offline mode?\n\n` +
            `• Type "offline start" to use your saved offline content\n` +
            `• Type "continue" to stay in online mode\n\n` +
            `Offline mode uses less data and works better in areas with poor internet.`,
          suggestionType: 'use_offline'
        };
      } else {
        // Suggest creating new package
        return {
          message:
            `📡 **LOW CONNECTIVITY DETECTED**\n\n` +
            `You appear to be in an area with poor internet connection. Would you like to download an offline package before connection worsens?\n\n` +
            `• Type "offline" to prepare offline content\n` +
            `• Type "continue" to stay in online mode\n\n` +
            `Offline packages allow you to continue studying even without internet.`,
          suggestionType: 'create_offline'
        };
      }
    } catch (error) {
      console.error('❌ Connectivity check error:', error);
      return null;
    }
  }
};


