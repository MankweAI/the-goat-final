/**
 * Lesson Content & Delivery Service
 * Date: 2025-08-18 11:35:00 UTC
 * Author: sophoniagoat
 *
 * Manages lesson content, delivery, and feedback collection
 */

import { executeQuery } from '../config/database.js';

export class LessonService {
  /**
   * Get lesson by ID
   *
   * @param {string} lessonId - Lesson ID
   * @returns {Object} Lesson data
   */
  async getLessonById(lessonId) {
    return executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .single();

      if (error) {
        console.error('❌ Lesson fetch error:', error);
        return null;
      }

      return data;
    });
  }

  /**
   * Get lessons by topic
   *
   * @param {string} topic - Topic name
   * @param {Object} options - Query options
   * @returns {Array} Lessons matching criteria
   */
  async getLessonsByTopic(topic, options = {}) {
    const { grade = null, limit = 5, orderByEffectiveness = true, excludeIds = [] } = options;

    return executeQuery(async (supabase) => {
      let query = supabase.from('lessons').select('*').eq('topic', topic).eq('is_active', true);

      // Apply grade filter if provided
      if (grade) {
        query = query.eq('grade_level', grade);
      }

      // Exclude specific lessons if needed
      if (excludeIds.length > 0) {
        query = query.not('id', 'in', `(${excludeIds.join(',')})`);
      }

      // Order by effectiveness score or recency
      if (orderByEffectiveness) {
        query = query.order('effectiveness_score', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query.limit(limit);

      if (error) {
        console.error('❌ Lessons by topic fetch error:', error);
        return [];
      }

      return data || [];
    });
  }

  /**
   * Format lesson for WhatsApp delivery
   *
   * @param {Object} lesson - Lesson object
   * @param {Object} options - Formatting options
   * @returns {string} Formatted lesson text
   */
  formatLesson(lesson, options = {}) {
    const {
      showHeader = true,
      showFooter = true,
      showFeedbackPrompt = true,
      dayNumber = null,
      lessonNumber = null,
      totalLessons = null
    } = options;

    let formattedLesson = '';

    // Add header if requested
    if (showHeader) {
      formattedLesson += `📚 **${lesson.title.toUpperCase()}**\n\n`;

      if (dayNumber !== null && lessonNumber !== null && totalLessons !== null) {
        formattedLesson += `Day ${dayNumber} - Lesson ${lessonNumber}/${totalLessons}\n\n`;
      }
    }

    // Add main content with proper formatting
    // Split into paragraphs and process each
    const paragraphs = lesson.content.split('\n\n');

    for (const paragraph of paragraphs) {
      // Skip empty paragraphs
      if (paragraph.trim().length === 0) continue;

      // Format special sections
      if (paragraph.startsWith('# ')) {
        // Main headers
        formattedLesson += `**${paragraph.substring(2).trim()}**\n\n`;
      } else if (paragraph.startsWith('## ')) {
        // Sub-headers
        formattedLesson += `*${paragraph.substring(3).trim()}*\n\n`;
      } else if (paragraph.startsWith('- ')) {
        // Bullet points
        formattedLesson += paragraph + '\n\n';
      } else if (paragraph.startsWith('Example:')) {
        // Examples
        formattedLesson += `💡 ${paragraph}\n\n`;
      } else if (paragraph.startsWith('Note:')) {
        // Notes
        formattedLesson += `📝 ${paragraph}\n\n`;
      } else if (paragraph.startsWith('Formula:')) {
        // Formulas
        formattedLesson += `📊 ${paragraph}\n\n`;
      } else {
        // Regular paragraphs
        formattedLesson += paragraph + '\n\n';
      }
    }

    // Add footer if requested
    if (showFooter) {
      formattedLesson += `------------------\n`;
      formattedLesson += `Type "next" when you're ready to continue!\n\n`;

      if (showFeedbackPrompt) {
        formattedLesson += `📝 Was this lesson helpful? Rate it by typing "rate 1-5"`;
      }
    }

    return formattedLesson;
  }

  /**
   * Record lesson view
   *
   * @param {string} lessonId - Lesson ID
   * @param {string} userId - User ID
   * @param {Object} context - View context
   * @returns {boolean} Success status
   */
  async recordLessonView(lessonId, userId, context = {}) {
    return executeQuery(async (supabase) => {
      // Create lesson view record
      const { error } = await supabase.from('lesson_views').insert({
        lesson_id: lessonId,
        user_id: userId,
        session_id: context.sessionId,
        study_plan_id: context.studyPlanId,
        day_number: context.dayNumber,
        viewed_at: new Date().toISOString(),
        context_data: context
      });

      if (error) {
        console.error('❌ Lesson view recording error:', error);
        return false;
      }

      // Update lesson usage count
      const { error: updateError } = await supabase
        .from('lessons')
        .update({
          usage_count: supabase.raw('usage_count + 1'),
          updated_at: new Date().toISOString()
        })
        .eq('id', lessonId);

      if (updateError) {
        console.error('❌ Lesson usage count update error:', updateError);
      }

      return true;
    });
  }

  /**
   * Submit lesson feedback
   *
   * @param {string} lessonId - Lesson ID
   * @param {string} userId - User ID
   * @param {number} helpfulnessRating - Rating 1-5
   * @param {number} understandingImprovement - Rating 1-5
   * @param {string} qualitativeFeedback - Text feedback
   * @returns {boolean} Success status
   */
  async submitLessonFeedback(
    lessonId,
    userId,
    helpfulnessRating,
    understandingImprovement = null,
    qualitativeFeedback = null
  ) {
    try {
      console.log(
        `📝 Recording lesson feedback: Lesson ${lessonId}, User ${userId}, Rating ${helpfulnessRating}`
      );

      // Validate rating
      const rating = parseInt(helpfulnessRating);
      if (isNaN(rating) || rating < 1 || rating > 5) {
        console.error('❌ Invalid rating value:', helpfulnessRating);
        return false;
      }

      // Convert understanding improvement to integer if provided
      let understanding = null;
      if (understandingImprovement !== null) {
        understanding = parseInt(understandingImprovement);
        if (isNaN(understanding) || understanding < 1 || understanding > 5) {
          understanding = null;
        }
      }

      // Record feedback
      await executeQuery(async (supabase) => {
        const { error } = await supabase.from('lesson_feedback').insert({
          lesson_id: lessonId,
          user_id: userId,
          helpfulness_rating: rating,
          understanding_improvement: understanding,
          qualitative_feedback: qualitativeFeedback,
          created_at: new Date().toISOString()
        });

        if (error) {
          console.error('❌ Lesson feedback recording error:', error);
          throw error;
        }
      });

      // Update lesson effectiveness score
      await this.updateLessonEffectivenessScore(lessonId);

      return true;
    } catch (error) {
      console.error('❌ Lesson feedback submission error:', error);
      return false;
    }
  }

  /**
   * Update lesson effectiveness score based on feedback
   *
   * @param {string} lessonId - Lesson ID
   * @returns {boolean} Success status
   */
  async updateLessonEffectivenessScore(lessonId) {
    return executeQuery(async (supabase) => {
      // Get all feedback for this lesson
      const { data: feedback, error } = await supabase
        .from('lesson_feedback')
        .select('helpfulness_rating, understanding_improvement')
        .eq('lesson_id', lessonId);

      if (error) {
        console.error('❌ Lesson feedback fetch error:', error);
        return false;
      }

      if (!feedback || feedback.length === 0) {
        return false;
      }

      // Calculate average helpfulness rating
      const helpfulnessSum = feedback.reduce(
        (sum, item) => sum + (item.helpfulness_rating || 0),
        0
      );
      const helpfulnessAvg = helpfulnessSum / feedback.length;

      // Calculate average understanding improvement (if available)
      let understandingAvg = 0;
      const understandingItems = feedback.filter((item) => item.understanding_improvement !== null);
      if (understandingItems.length > 0) {
        const understandingSum = understandingItems.reduce(
          (sum, item) => sum + (item.understanding_improvement || 0),
          0
        );
        understandingAvg = understandingSum / understandingItems.length;
      }

      // Calculate effectiveness score (weighted combination of both metrics)
      // More weight on helpfulness (70%) than understanding improvement (30%)
      const effectivenessScore =
        understandingItems.length > 0
          ? helpfulnessAvg * 0.7 + understandingAvg * 0.3
          : helpfulnessAvg;

      // Update lesson with new score
      const { error: updateError } = await supabase
        .from('lessons')
        .update({
          effectiveness_score: effectivenessScore,
          updated_at: new Date().toISOString()
        })
        .eq('id', lessonId);

      if (updateError) {
        console.error('❌ Lesson effectiveness update error:', updateError);
        return false;
      }

      console.log(`✅ Updated lesson ${lessonId} effectiveness score to ${effectivenessScore}`);
      return true;
    });
  }

  /**
   * Get most effective lessons by topic
   *
   * @param {string} topic - Topic name
   * @param {number} limit - Number of lessons to return
   * @returns {Array} Top-rated lessons
   */
  async getMostEffectiveLessons(topic, limit = 5) {
    return executeQuery(async (supabase) => {
      let query = supabase
        .from('lessons')
        .select('*')
        .eq('is_active', true)
        .order('effectiveness_score', { ascending: false });

      // Filter by topic if provided
      if (topic) {
        query = query.eq('topic', topic);
      }

      const { data, error } = await query.limit(limit);

      if (error) {
        console.error('❌ Effective lessons fetch error:', error);
        return [];
      }

      return data || [];
    });
  }

  /**
   * Get recommended next lesson based on user history
   *
   * @param {string} userId - User ID
   * @param {string} currentTopic - Current topic
   * @returns {Object} Recommended lesson
   */
  async getRecommendedNextLesson(userId, currentTopic) {
    try {
      // Get user's viewed lessons
      const viewedLessons = await this.getUserViewedLessons(userId);
      const viewedIds = viewedLessons.map((view) => view.lesson_id);

      // Get lessons that received high ratings from similar users
      const highlyRatedLessons = await this.getHighlyRatedLessonsForTopic(currentTopic, 10);

      // Filter out lessons the user has already seen
      const unseenHighlyRated = highlyRatedLessons.filter(
        (lesson) => !viewedIds.includes(lesson.id)
      );

      if (unseenHighlyRated.length > 0) {
        // Return the most effective unseen lesson
        return unseenHighlyRated[0];
      }

      // Fallback: get any lesson on the topic the user hasn't seen
      const topicLessons = await this.getLessonsByTopic(currentTopic, {
        excludeIds: viewedIds,
        limit: 1
      });

      if (topicLessons.length > 0) {
        return topicLessons[0];
      }

      // Ultimate fallback: just get the most effective lesson even if seen before
      const anyLesson = await this.getLessonsByTopic(currentTopic, {
        limit: 1
      });

      return anyLesson.length > 0 ? anyLesson[0] : null;
    } catch (error) {
      console.error('❌ Lesson recommendation error:', error);
      return null;
    }
  }

  /**
   * Get user's viewed lessons
   *
   * @param {string} userId - User ID
   * @returns {Array} Viewed lessons
   */
  async getUserViewedLessons(userId) {
    return executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('lesson_views')
        .select('lesson_id, viewed_at')
        .eq('user_id', userId)
        .order('viewed_at', { ascending: false });

      if (error) {
        console.error('❌ User viewed lessons fetch error:', error);
        return [];
      }

      return data || [];
    });
  }

  /**
   * Get highly rated lessons for a topic
   *
   * @param {string} topic - Topic name
   * @param {number} limit - Number of lessons to return
   * @returns {Array} Highly rated lessons
   */
  async getHighlyRatedLessonsForTopic(topic, limit = 5) {
    return executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('topic', topic)
        .eq('is_active', true)
        .gte('effectiveness_score', 4) // Minimum score of 4 out of 5
        .order('effectiveness_score', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Highly rated lessons fetch error:', error);
        return [];
      }

      return data || [];
    });
  }

  /**
   * Create a new lesson
   *
   * @param {Object} lessonData - Lesson data
   * @returns {Object} Created lesson
   */
  async createLesson(lessonData) {
    return executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('lessons')
        .insert({
          title: lessonData.title,
          content: lessonData.content,
          topic: lessonData.topic,
          subject: lessonData.subject || 'math',
          grade_level: lessonData.grade_level,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Lesson creation error:', error);
        throw error;
      }

      return data;
    });
  }

  /**
   * Get lessons by user feedback
   *
   * @param {string} userId - User ID
   * @returns {Array} Lessons with user feedback
   */
  async getLessonsByUserFeedback(userId) {
    return executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('lesson_feedback')
        .select(
          `
          helpfulness_rating,
          understanding_improvement,
          qualitative_feedback,
          created_at,
          lessons (
            id,
            title,
            topic,
            subject,
            grade_level
          )
        `
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ User feedback fetch error:', error);
        return [];
      }

      return data || [];
    });
  }
}

export const lessonService = new LessonService();


