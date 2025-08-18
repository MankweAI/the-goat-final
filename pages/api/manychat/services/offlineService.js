/**
 * Offline Mode Service
 * Date: 2025-08-18 12:39:37 UTC
 * Author: sophoniagoat
 *
 * Provides functionality for offline and low-connectivity environments
 */

import { executeQuery } from '../config/database.js';
import { practiceService } from './practiceService.js';
import { lessonService } from './lessonService.js';

export class OfflineService {
  /**
   * Generate offline content package for a user
   *
   * @param {string} userId - User ID
   * @param {Object} options - Package options
   * @returns {Object} Offline content package
   */
  async generateOfflinePackage(userId, options = {}) {
    try {
      console.log(`📦 Generating offline package for user ${userId}`);

      const {
        includeTopics = [],
        daysToInclude = 3,
        includeCurrentPlan = true,
        practiceQuestionsPerTopic = 5,
        lessonsPerTopic = 3,
        maxPackageSize = 100 // KB
      } = options;

      // Get user data
      const user = await this.getUserForOffline(userId);

      // Initialize package
      const offlinePackage = {
        user_id: userId,
        generated_at: new Date().toISOString(),
        expires_at: this.calculateExpiryDate(daysToInclude),
        content_version: '1.0',
        study_plan: null,
        lessons: [],
        practice_questions: [],
        topics_included: []
      };

      // Add study plan if requested
      if (includeCurrentPlan) {
        const activePlan = await this.getUserActivePlan(userId);
        if (activePlan) {
          offlinePackage.study_plan = this.formatPlanForOffline(activePlan, daysToInclude);
        }
      }

      // Determine topics to include
      let topics = [...includeTopics];

      // Add topics from study plan if available
      if (offlinePackage.study_plan && offlinePackage.study_plan.topics) {
        topics = [...new Set([...topics, ...offlinePackage.study_plan.topics])];
      }

      // If no topics specified, add recommended topics
      if (topics.length === 0) {
        const recommendedTopics = await this.getRecommendedTopicsForUser(userId);
        topics = recommendedTopics.slice(0, 3); // Limit to top 3
      }

      // Get lessons and practice questions for each topic
      for (const topic of topics) {
        // Get lessons for this topic
        const topicLessons = await lessonService.getLessonsByTopic(topic, {
          grade: user.grade,
          limit: lessonsPerTopic,
          orderByEffectiveness: true
        });

        // Get practice questions for this topic
        const topicQuestions = await practiceService.getQuestionsByTopic(topic, {
          grade: user.grade,
          limit: practiceQuestionsPerTopic
        });

        // Add content to package
        offlinePackage.lessons.push(...topicLessons);
        offlinePackage.practice_questions.push(...topicQuestions);
        offlinePackage.topics_included.push(topic);
      }

      // Format content for offline use
      this.optimizeContentForOffline(offlinePackage);

      // Check package size and trim if needed
      const packageSize = this.estimatePackageSize(offlinePackage);

      if (packageSize > maxPackageSize) {
        this.trimPackageToSize(offlinePackage, maxPackageSize);
      }

      // Save package to database
      const savedPackage = await this.saveOfflinePackage(userId, offlinePackage);

      return {
        package_id: savedPackage.id,
        content: offlinePackage,
        size_kb: this.estimatePackageSize(offlinePackage),
        topics: offlinePackage.topics_included,
        expiry_date: offlinePackage.expires_at
      };
    } catch (error) {
      console.error('❌ Offline package generation error:', error);
      return {
        error: 'Failed to generate offline package',
        fallback_package: await this.generateFallbackPackage(userId)
      };
    }
  }

  /**
   * Get user data for offline package
   *
   * @param {string} userId - User ID
   * @returns {Object} User data
   */
  async getUserForOffline(userId) {
    return executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, grade, current_menu, exam_prep_session_id')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ User fetch error:', error);
        return { id: userId, grade: 10 };
      }

      return data;
    });
  }

  /**
   * Get user's active study plan
   *
   * @param {string} userId - User ID
   * @returns {Object} Active plan data
   */
  async getUserActivePlan(userId) {
    return executeQuery(async (supabase) => {
      // Get active session
      const { data: session } = await supabase
        .from('exam_prep_sessions')
        .select('id, study_plan_id, focus_subject, focus_topics')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!session || !session.study_plan_id) {
        return null;
      }

      // Get study plan
      const { data: plan } = await supabase
        .from('study_plans')
        .select('*')
        .eq('id', session.study_plan_id)
        .eq('is_active', true)
        .single();

      if (!plan) {
        return null;
      }

      return {
        id: plan.id,
        session_id: session.id,
        plan_data: plan.plan_data,
        current_day: plan.current_day || 1,
        subject: session.focus_subject,
        topics: session.focus_topics
      };
    });
  }

  /**
   * Format study plan for offline use
   *
   * @param {Object} plan - Study plan
   * @param {number} daysToInclude - Number of days to include
   * @returns {Object} Formatted plan
   */
  formatPlanForOffline(plan, daysToInclude) {
    if (!plan || !plan.plan_data || !plan.plan_data.days) {
      return null;
    }

    const planData = plan.plan_data;
    const currentDay = plan.current_day || 1;

    // Include only current day and future days (up to daysToInclude)
    const includedDays = planData.days.filter(
      (d) => d.day >= currentDay && d.day < currentDay + daysToInclude
    );

    // Create simplified plan
    return {
      id: plan.id,
      subject: plan.subject || planData.subject,
      topics: plan.topics || planData.topics,
      current_day: currentDay,
      total_days: planData.total_days,
      days: includedDays
    };
  }

  /**
   * Get recommended topics for a user
   *
   * @param {string} userId - User ID
   * @returns {Array} Recommended topics
   */
  async getRecommendedTopicsForUser(userId) {
    return executeQuery(async (supabase) => {
      // Get topic performance
      const { data: topicPerformance } = await supabase
        .from('topic_performance')
        .select('*')
        .eq('user_id', userId)
        .order('last_practiced_at', { ascending: false });

      if (!topicPerformance || topicPerformance.length === 0) {
        // No performance data, return default topics
        return ['algebra', 'geometry', 'trigonometry'];
      }

      // Prioritize recently practiced topics
      return topicPerformance.map((tp) => tp.topic);
    });
  }

  /**
   * Optimize content for offline use
   *
   * @param {Object} offlinePackage - Offline package
   */
  optimizeContentForOffline(offlinePackage) {
    // Remove unnecessary fields from lessons
    if (offlinePackage.lessons) {
      offlinePackage.lessons = offlinePackage.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        content: lesson.content,
        topic: lesson.topic,
        subject: lesson.subject,
        grade_level: lesson.grade_level
      }));
    }

    // Remove unnecessary fields from practice questions
    if (offlinePackage.practice_questions) {
      offlinePackage.practice_questions = offlinePackage.practice_questions.map((question) => ({
        id: question.id,
        question_text: question.question_text,
        solution_steps: question.solution_steps,
        topic: question.topic,
        subject: question.subject,
        difficulty: question.difficulty,
        key_concepts: question.key_concepts,
        hints: question.hints
      }));
    }

    // Simplify study plan structure
    if (offlinePackage.study_plan && offlinePackage.study_plan.days) {
      offlinePackage.study_plan.days = offlinePackage.study_plan.days.map((day) => ({
        day: day.day,
        date: day.date,
        focus: day.focus,
        lessons: day.lessons
          ? day.lessons.map((lesson) => ({
              id: lesson.id,
              title: lesson.title
            }))
          : [],
        practice_questions: day.practice_questions
          ? day.practice_questions.map((question) => ({
              id: question.id,
              topic: question.topic,
              difficulty: question.difficulty
            }))
          : [],
        engagement_hooks: {
          morning_message: day.engagement_hooks?.morning_message,
          reminder_message: day.engagement_hooks?.reminder_message
        }
      }));
    }
  }

  /**
   * Estimate package size in KB
   *
   * @param {Object} offlinePackage - Offline package
   * @returns {number} Estimated size in KB
   */
  estimatePackageSize(offlinePackage) {
    // Convert to JSON and measure string length
    const packageJson = JSON.stringify(offlinePackage);
    // 1 character is approximately 1 byte in UTF-8 (average case)
    const sizeInBytes = packageJson.length;
    // Convert to KB
    return Math.ceil(sizeInBytes / 1024);
  }

  /**
   * Trim package content to fit size limit
   *
   * @param {Object} offlinePackage - Offline package to trim
   * @param {number} maxSizeKB - Maximum size in KB
   */
  trimPackageToSize(offlinePackage, maxSizeKB) {
    let currentSize = this.estimatePackageSize(offlinePackage);

    // If already under size limit, no need to trim
    if (currentSize <= maxSizeKB) {
      return;
    }

    // Trim practice questions first (least critical)
    while (currentSize > maxSizeKB && offlinePackage.practice_questions.length > 0) {
      offlinePackage.practice_questions.pop();
      currentSize = this.estimatePackageSize(offlinePackage);
    }

    // If still over limit, trim lessons
    while (currentSize > maxSizeKB && offlinePackage.lessons.length > 0) {
      offlinePackage.lessons.pop();
      currentSize = this.estimatePackageSize(offlinePackage);
    }

    // If still over limit, simplify study plan
    if (currentSize > maxSizeKB && offlinePackage.study_plan) {
      // Keep only the current day
      if (offlinePackage.study_plan.days.length > 1) {
        const currentDay = offlinePackage.study_plan.current_day;
        offlinePackage.study_plan.days = offlinePackage.study_plan.days.filter(
          (d) => d.day === currentDay
        );
        currentSize = this.estimatePackageSize(offlinePackage);
      }
    }

    // If still over limit, remove study plan entirely
    if (currentSize > maxSizeKB) {
      offlinePackage.study_plan = null;
    }
  }

  /**
   * Calculate expiry date for offline package
   *
   * @param {number} daysValid - Number of days package is valid
   * @returns {string} Expiry date ISO string
   */
  calculateExpiryDate(daysValid) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysValid);
    return expiryDate.toISOString();
  }

  /**
   * Save offline package to database
   *
   * @param {string} userId - User ID
   * @param {Object} packageData - Package data
   * @returns {Object} Saved package
   */
  async saveOfflinePackage(userId, packageData) {
    return executeQuery(async (supabase) => {
      // Create package record
      const { data, error } = await supabase
        .from('offline_packages')
        .insert({
          user_id: userId,
          package_data: packageData,
          size_kb: this.estimatePackageSize(packageData),
          topics_included: packageData.topics_included,
          expires_at: packageData.expires_at,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Package save error:', error);
        throw error;
      }

      return data;
    });
  }

  /**
   * Get latest offline package for a user
   *
   * @param {string} userId - User ID
   * @returns {Object} Latest offline package
   */
  async getLatestOfflinePackage(userId) {
    return executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('offline_packages')
        .select('*')
        .eq('user_id', userId)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('❌ Package fetch error:', error);
        return null;
      }

      return data;
    });
  }

  /**
   * Generate fallback package with minimal content
   *
   * @param {string} userId - User ID
   * @returns {Object} Fallback package
   */
  async generateFallbackPackage(userId) {
    try {
      // Create a minimal package with essential content
      const fallbackPackage = {
        user_id: userId,
        generated_at: new Date().toISOString(),
        expires_at: this.calculateExpiryDate(7),
        content_version: '1.0',
        study_plan: null,
        lessons: [],
        practice_questions: [],
        topics_included: ['algebra', 'general']
      };

      // Add a few basic lessons
      const basicLessons = await executeQuery(async (supabase) => {
        const { data, error } = await supabase
          .from('lessons')
          .select('id, title, content, topic, subject, grade_level')
          .in('topic', ['algebra', 'general'])
          .limit(3);

        if (error) {
          console.error('❌ Fallback lessons fetch error:', error);
          return [];
        }

        return data || [];
      });

      fallbackPackage.lessons = basicLessons;

      // Add a few basic practice questions
      const basicQuestions = await executeQuery(async (supabase) => {
        const { data, error } = await supabase
          .from('practice_questions')
          .select('id, question_text, solution_steps, topic, subject, difficulty, hints')
          .in('topic', ['algebra', 'general'])
          .limit(5);

        if (error) {
          console.error('❌ Fallback questions fetch error:', error);
          return [];
        }

        return data || [];
      });

      fallbackPackage.practice_questions = basicQuestions;

      // Save fallback package
      return await this.saveOfflinePackage(userId, fallbackPackage);
    } catch (error) {
      console.error('❌ Fallback package error:', error);

      // Return minimal emergency package
      return {
        id: 'fallback-emergency',
        user_id: userId,
        package_data: {
          user_id: userId,
          generated_at: new Date().toISOString(),
          expires_at: this.calculateExpiryDate(7),
          content_version: '1.0',
          topics_included: ['general'],
          lessons: [
            {
              id: 'fallback-lesson',
              title: 'Basic Algebra Concepts',
              content:
                'Algebra is the branch of mathematics that deals with symbols and the rules for manipulating these symbols. In algebra, we use letters to represent numbers and quantities. These letters are called variables because the values they represent can vary.',
              topic: 'algebra',
              subject: 'math',
              grade_level: 10
            }
          ],
          practice_questions: [
            {
              id: 'fallback-question',
              question_text: 'Solve for x: 2x + 5 = 13',
              solution_steps:
                'Step 1: Subtract 5 from both sides: 2x = 8\nStep 2: Divide both sides by 2: x = 4',
              topic: 'algebra',
              subject: 'math',
              difficulty: 'easy',
              hints: ['Start by isolating the variable']
            }
          ]
        },
        size_kb: 2,
        topics_included: ['general'],
        expires_at: this.calculateExpiryDate(7),
        created_at: new Date().toISOString()
      };
    }
  }

  /**
   * Format offline package for WhatsApp delivery
   *
   * @param {Object} offlinePackage - Offline package
   * @returns {string} Formatted package info
   */
  formatOfflinePackageInfo(offlinePackage) {
    if (!offlinePackage || !offlinePackage.package_data) {
      return `No offline package available. Please request a new package.`;
    }

    const packageData = offlinePackage.package_data;

    let info = `📦 **OFFLINE PACKAGE READY**\n\n`;

    // Package details
    info += `Package size: ${offlinePackage.size_kb}KB\n`;
    info += `Expires: ${new Date(packageData.expires_at).toDateString()}\n\n`;

    // Content summary
    info += `**INCLUDED CONTENT:**\n`;

    if (packageData.topics_included && packageData.topics_included.length > 0) {
      info += `Topics: ${packageData.topics_included.join(', ')}\n`;
    }

    if (packageData.lessons) {
      info += `Lessons: ${packageData.lessons.length}\n`;
    }

    if (packageData.practice_questions) {
      info += `Practice questions: ${packageData.practice_questions.length}\n`;
    }

    if (packageData.study_plan) {
      const dayCount = packageData.study_plan.days ? packageData.study_plan.days.length : 0;
      info += `Study plan: ${dayCount} day${dayCount !== 1 ? 's' : ''}\n`;
    }

    info += `\n**USAGE INSTRUCTIONS:**\n`;
    info += `• Save this message for offline access\n`;
    info += `• Type "offline start" to begin using offline content\n`;
    info += `• When online again, type "sync" to update progress\n\n`;

    info += `Type "download" to receive the full offline package.`;

    return info;
  }

  /**
   * Sync offline progress with server
   *
   * @param {string} userId - User ID
   * @param {Object} progressData - Offline progress data
   * @returns {Object} Sync result
   */
  async syncOfflineProgress(userId, progressData) {
    try {
      console.log(`🔄 Syncing offline progress for user ${userId}`);

      if (!progressData) {
        return {
          success: false,
          message: 'No progress data provided'
        };
      }

      // Record lesson completions
      if (progressData.completed_lessons && progressData.completed_lessons.length > 0) {
        await this.syncLessonCompletions(userId, progressData.completed_lessons);
      }

      // Record practice attempts
      if (progressData.practice_attempts && progressData.practice_attempts.length > 0) {
        await this.syncPracticeAttempts(userId, progressData.practice_attempts);
      }

      // Record study plan progress
      if (progressData.plan_progress) {
        await this.syncStudyPlanProgress(userId, progressData.plan_progress);
      }

      return {
        success: true,
        message: 'Progress synchronized successfully',
        sync_time: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Sync error:', error);
      return {
        success: false,
        message: 'Failed to synchronize progress',
        error: error.message
      };
    }
  }

  /**
   * Sync lesson completions
   *
   * @param {string} userId - User ID
   * @param {Array} completedLessons - Completed lessons data
   */
  async syncLessonCompletions(userId, completedLessons) {
    return executeQuery(async (supabase) => {
      for (const lesson of completedLessons) {
        // Check if already recorded
        const { data: existing } = await supabase
          .from('lesson_views')
          .select('id')
          .eq('user_id', userId)
          .eq('lesson_id', lesson.id)
          .eq('viewed_at', lesson.viewed_at)
          .maybeSingle();

        if (!existing) {
          // Record new lesson view
          await supabase.from('lesson_views').insert({
            user_id: userId,
            lesson_id: lesson.id,
            viewed_at: lesson.viewed_at || new Date().toISOString(),
            context_data: { offline: true, ...lesson.context },
            created_at: new Date().toISOString()
          });

          // Record feedback if provided
          if (lesson.feedback && lesson.feedback.rating) {
            await supabase.from('lesson_feedback').insert({
              lesson_id: lesson.id,
              user_id: userId,
              helpfulness_rating: lesson.feedback.rating,
              qualitative_feedback: lesson.feedback.text || null,
              created_at: new Date().toISOString()
            });
          }
        }
      }
    });
  }

  /**
   * Sync practice attempts
   *
   * @param {string} userId - User ID
   * @param {Array} practiceAttempts - Practice attempts data
   */
  async syncPracticeAttempts(userId, practiceAttempts) {
    return executeQuery(async (supabase) => {
      for (const attempt of practiceAttempts) {
        // Check if already recorded
        const { data: existing } = await supabase
          .from('practice_attempts')
          .select('id')
          .eq('user_id', userId)
          .eq('question_id', attempt.question_id)
          .eq('started_at', attempt.started_at)
          .maybeSingle();

        if (!existing) {
          // Record new attempt
          await supabase.from('practice_attempts').insert({
            user_id: userId,
            question_id: attempt.question_id,
            status: attempt.status || 'completed',
            hints_used: attempt.hints_used || 0,
            understanding_rating: attempt.understanding_rating,
            user_response: attempt.user_response,
            started_at: attempt.started_at || new Date().toISOString(),
            completed_at: attempt.completed_at,
            context_data: { offline: true, ...attempt.context }
          });
        }
      }
    });
  }

  /**
   * Sync study plan progress
   *
   * @param {string} userId - User ID
   * @param {Object} planProgress - Study plan progress data
   */
  async syncStudyPlanProgress(userId, planProgress) {
    if (!planProgress.plan_id) {
      return;
    }

    return executeQuery(async (supabase) => {
      // Get current plan
      const { data: plan } = await supabase
        .from('study_plans')
        .select('id, plan_data, current_day')
        .eq('id', planProgress.plan_id)
        .single();

      if (!plan) {
        return;
      }

      // Update plan with offline progress
      const planData = plan.plan_data;
      const completedDays = planProgress.completed_days || [];

      // Mark days as completed
      completedDays.forEach((dayNumber) => {
        const dayIndex = planData.days.findIndex((d) => d.day === dayNumber);
        if (dayIndex >= 0) {
          planData.days[dayIndex].completed = true;
          planData.days[dayIndex].completed_at = planProgress.sync_time || new Date().toISOString();
        }
      });

      // Update current day to max completed day + 1
      const maxCompletedDay = Math.max(0, ...completedDays);
      const currentDay = Math.max(plan.current_day, maxCompletedDay + 1);

      // Save updated plan
      await supabase
        .from('study_plans')
        .update({
          plan_data: planData,
          current_day: currentDay,
          updated_at: new Date().toISOString()
        })
        .eq('id', plan.id);
    });
  }

  /**
   * Check if user is in a low-connectivity area
   *
   * @param {Object} connectionData - Connection data
   * @returns {boolean} Is low connectivity
   */
  isLowConnectivity(connectionData) {
    if (!connectionData) {
      return false;
    }

    // Check response time
    if (connectionData.response_time_ms && connectionData.response_time_ms > 3000) {
      return true;
    }

    // Check signal strength
    if (connectionData.signal_strength && connectionData.signal_strength < 2) {
      return true;
    }

    // Check connection type
    if (connectionData.connection_type === '2g' || connectionData.connection_type === 'slow-3g') {
      return true;
    }

    return false;
  }

  /**
   * Check if an offline package needs update
   *
   * @param {Object} offlinePackage - Current offline package
   * @returns {boolean} Needs update
   */
  packageNeedsUpdate(offlinePackage) {
    if (!offlinePackage || !offlinePackage.package_data) {
      return true;
    }

    // Check expiry date
    const expiryDate = new Date(offlinePackage.package_data.expires_at);
    const now = new Date();

    // Consider update needed if less than 1 day until expiry
    const oneDayBeforeExpiry = new Date(expiryDate);
    oneDayBeforeExpiry.setDate(oneDayBeforeExpiry.getDate() - 1);

    return now > oneDayBeforeExpiry;
  }
}

export const offlineService = new OfflineService();


