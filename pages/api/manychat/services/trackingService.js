/**
 * User Activity Tracking Service
 * Date: 2025-08-18 12:28:45 UTC
 * Author: sophoniagoat
 * 
 * Tracks user activities for analytics and progress monitoring
 */

import { executeQuery } from '../config/database.js';

export class TrackingService {
  /**
   * Log user activity
   *
   * @param {string} userId - User ID
   * @param {string} activityType - Type of activity
   * @param {Object} activityData - Additional activity data
   * @returns {boolean} Success status
   */
  async logActivity(userId, activityType, activityData = {}) {
    try {
      console.log(`📝 Logging activity for user ${userId}: ${activityType}`);

      await executeQuery(async (supabase) => {
        // Create activity log entry
        const { error } = await supabase.from('user_activity_log').insert({
          user_id: userId,
          activity_type: activityType,
          activity_date: new Date().toISOString(),
          activity_data: activityData,
          created_at: new Date().toISOString()
        });

        if (error) {
          console.error('❌ Activity logging error:', error);
          throw error;
        }
      });

      // Update user streak
      await this.updateUserStreak(userId);

      return true;
    } catch (error) {
      console.error('❌ Activity tracking error:', error);
      return false;
    }
  }

  /**
   * Start tracking a study session
   *
   * @param {string} userId - User ID
   * @param {string} sessionType - Type of study session
   * @param {Object} sessionData - Additional session data
   * @returns {string} Session ID
   */
  async startStudySession(userId, sessionType, sessionData = {}) {
    return executeQuery(async (supabase) => {
      // Create study session record
      const { data, error } = await supabase
        .from('study_sessions')
        .insert({
          user_id: userId,
          session_type: sessionType,
          start_time: new Date().toISOString(),
          topic: sessionData.topic || null,
          session_data: sessionData,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        console.error('❌ Study session start error:', error);
        throw error;
      }

      return data.id;
    });
  }

  /**
   * End tracking a study session
   *
   * @param {string} sessionId - Session ID
   * @param {Object} additionalData - Additional session data
   * @returns {boolean} Success status
   */
  async endStudySession(sessionId, additionalData = {}) {
    try {
      const endTime = new Date().toISOString();

      await executeQuery(async (supabase) => {
        // Get session start time
        const { data: session } = await supabase
          .from('study_sessions')
          .select('start_time, session_data')
          .eq('id', sessionId)
          .single();

        if (!session) {
          throw new Error(`Session not found: ${sessionId}`);
        }

        // Calculate duration in minutes
        const startTime = new Date(session.start_time);
        const durationMs = new Date(endTime).getTime() - startTime.getTime();
        const durationMinutes = Math.round(durationMs / (1000 * 60));

        // Merge session data
        const mergedSessionData = {
          ...(session.session_data || {}),
          ...additionalData
        };

        // Update session record
        const { error } = await supabase
          .from('study_sessions')
          .update({
            end_time: endTime,
            duration_minutes: durationMinutes,
            end_time: endTime,
            duration_minutes: durationMinutes,
            session_data: mergedSessionData
          })
          .eq('id', sessionId);

        if (error) {
          console.error('❌ Study session end error:', error);
          throw error;
        }
      });

      return true;
    } catch (error) {
      console.error('❌ Session tracking error:', error);
      return false;
    }
  }

  /**
   * Update user streak based on activity
   *
   * @param {string} userId - User ID
   * @returns {boolean} Success status
   */
  async updateUserStreak(userId) {
    try {
      await executeQuery(async (supabase) => {
        // Get current date (without time)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get yesterday's date
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // Get user's streak record
        const { data: streakRecord } = await supabase
          .from('user_streaks')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (!streakRecord) {
          // Create new streak record
          await supabase.from('user_streaks').insert({
            user_id: userId,
            current_streak: 1,
            longest_streak: 1,
            last_activity_date: today.toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

          return;
        }

        // Get last activity date
        const lastActivityDate = new Date(streakRecord.last_activity_date);
        lastActivityDate.setHours(0, 0, 0, 0);

        // Check if already logged today
        if (lastActivityDate.getTime() === today.getTime()) {
          // Already logged today, no streak update needed
          return;
        }

        // Check if streak continues from yesterday
        let newStreak = streakRecord.current_streak;

        if (lastActivityDate.getTime() === yesterday.getTime()) {
          // Consecutive day, increment streak
          newStreak += 1;
        } else {
          // Streak broken, reset to 1
          newStreak = 1;
        }

        // Calculate longest streak
        const longestStreak = Math.max(newStreak, streakRecord.longest_streak || 0);

        // Update streak record
        await supabase
          .from('user_streaks')
          .update({
            current_streak: newStreak,
            longest_streak: longestStreak,
            last_activity_date: today.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', streakRecord.id);
      });

      return true;
    } catch (error) {
      console.error('❌ Streak update error:', error);
      return false;
    }
  }

  /**
   * Get user's current streak information
   *
   * @param {string} userId - User ID
   * @returns {Object} Streak information
   */
  async getUserStreakInfo(userId) {
    return executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('❌ Streak info fetch error:', error);
        return {
          current_streak: 0,
          longest_streak: 0,
          last_activity_date: null
        };
      }

      return (
        data || {
          current_streak: 0,
          longest_streak: 0,
          last_activity_date: null
        }
      );
    });
  }

  /**
   * Record progress on a specific topic
   *
   * @param {string} userId - User ID
   * @param {string} topic - Topic name
   * @param {Object} progressData - Progress data
   * @returns {boolean} Success status
   */
  async recordTopicProgress(userId, topic, progressData = {}) {
    try {
      const {
        understanding = null,
        completed = false,
        strengths = [],
        weaknesses = []
      } = progressData;

      await executeQuery(async (supabase) => {
        // Check if topic performance record exists
        const { data: existingRecord } = await supabase
          .from('topic_performance')
          .select('*')
          .eq('user_id', userId)
          .eq('topic', topic)
          .maybeSingle();

        const now = new Date().toISOString();

        if (existingRecord) {
          // Update existing record
          const updatedRecord = {
            updated_at: now,
            last_practiced_at: now
          };

          // Update attempts count
          updatedRecord.attempts_count = (existingRecord.attempts_count || 0) + 1;

          // Update completed count if applicable
          if (completed) {
            updatedRecord.completed_count = (existingRecord.completed_count || 0) + 1;
          }

          // Update average understanding if provided
          if (understanding !== null) {
            const currentAvg = existingRecord.average_understanding || 0;
            const currentCount = existingRecord.attempts_count || 0;

            // Calculate new average
            if (currentCount > 0) {
              updatedRecord.average_understanding =
                (currentAvg * currentCount + understanding) / (currentCount + 1);
            } else {
              updatedRecord.average_understanding = understanding;
            }
          }

          // Update strengths if provided
          if (strengths.length > 0) {
            updatedRecord.strengths = [
              ...new Set([...(existingRecord.strengths || []), ...strengths])
            ];
          }

          // Update weaknesses if provided
          if (weaknesses.length > 0) {
            updatedRecord.weaknesses = [
              ...new Set([...(existingRecord.weaknesses || []), ...weaknesses])
            ];
          }

          // Calculate mastery level
          const masteryPercentage = updatedRecord.average_understanding
            ? Math.round((updatedRecord.average_understanding / 5) * 100)
            : Math.min(
                Math.round(
                  (updatedRecord.completed_count / Math.max(updatedRecord.attempts_count, 1)) * 100
                ),
                100
              );

          let masteryLevel;
          if (masteryPercentage >= 90) masteryLevel = 'mastered';
          else if (masteryPercentage >= 75) masteryLevel = 'advanced';
          else if (masteryPercentage >= 60) masteryLevel = 'proficient';
          else if (masteryPercentage >= 40) masteryLevel = 'developing';
          else masteryLevel = 'beginner';

          updatedRecord.mastery_level = masteryLevel;

          // Update record
          await supabase
            .from('topic_performance')
            .update(updatedRecord)
            .eq('id', existingRecord.id);
        } else {
          // Create new record
          await supabase.from('topic_performance').insert({
            user_id: userId,
            topic: topic,
            attempts_count: 1,
            completed_count: completed ? 1 : 0,
            average_understanding: understanding !== null ? understanding : null,
            strengths: strengths,
            weaknesses: weaknesses,
            mastery_level: 'beginner',
            last_practiced_at: now,
            created_at: now,
            updated_at: now
          });
        }
      });

      return true;
    } catch (error) {
      console.error('❌ Topic progress recording error:', error);
      return false;
    }
  }

  /**
   * Get user's session statistics
   *
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Object} Session statistics
   */
  async getSessionStats(userId, options = {}) {
    try {
      const { daysLookback = 30, sessionType = null } = options;

      // Get start date for lookback period
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysLookback);

      return executeQuery(async (supabase) => {
        // Build query
        let query = supabase
          .from('study_sessions')
          .select('*')
          .eq('user_id', userId)
          .gte('start_time', startDate.toISOString());

        // Filter by session type if provided
        if (sessionType) {
          query = query.eq('session_type', sessionType);
        }

        const { data, error } = await query;

        if (error) {
          console.error('❌ Session stats fetch error:', error);
          return {
            total_sessions: 0,
            total_duration_minutes: 0,
            average_duration_minutes: 0,
            sessions_by_type: {},
            sessions_by_topic: {}
          };
        }

        // No sessions found
        if (!data || data.length === 0) {
          return {
            total_sessions: 0,
            total_duration_minutes: 0,
            average_duration_minutes: 0,
            sessions_by_type: {},
            sessions_by_topic: {}
          };
        }

        // Calculate statistics
        const totalSessions = data.length;
        const completedSessions = data.filter((s) => s.end_time && s.duration_minutes);

        const totalDuration = completedSessions.reduce(
          (sum, session) => sum + (session.duration_minutes || 0),
          0
        );

        const averageDuration =
          completedSessions.length > 0 ? totalDuration / completedSessions.length : 0;

        // Count by session type
        const sessionsByType = {};
        data.forEach((session) => {
          const type = session.session_type || 'unknown';
          sessionsByType[type] = (sessionsByType[type] || 0) + 1;
        });

        // Count by topic
        const sessionsByTopic = {};
        data.forEach((session) => {
          if (session.topic) {
            sessionsByTopic[session.topic] = (sessionsByTopic[session.topic] || 0) + 1;
          }
        });

        return {
          total_sessions: totalSessions,
          total_duration_minutes: totalDuration,
          average_duration_minutes: averageDuration,
          sessions_by_type: sessionsByType,
          sessions_by_topic: sessionsByTopic,
          daily_activity: this.calculateDailyActivity(data)
        };
      });
    } catch (error) {
      console.error('❌ Session stats error:', error);
      return {
        total_sessions: 0,
        total_duration_minutes: 0,
        average_duration_minutes: 0,
        sessions_by_type: {},
        sessions_by_topic: {}
      };
    }
  }

  /**
   * Calculate daily activity from session data
   *
   * @param {Array} sessions - Session data
   * @returns {Object} Daily activity counts
   */
  calculateDailyActivity(sessions) {
    const dailyActivity = {};

    sessions.forEach((session) => {
      if (!session.start_time) return;

      // Extract date part only (YYYY-MM-DD)
      const dateStr = session.start_time.split('T')[0];

      if (!dailyActivity[dateStr]) {
        dailyActivity[dateStr] = {
          count: 0,
          duration: 0
        };
      }

      dailyActivity[dateStr].count += 1;
      dailyActivity[dateStr].duration += session.duration_minutes || 0;
    });

    return dailyActivity;
  }

  /**
   * Log specific types of events
   */

  // Log lesson completion
  async logLessonCompletion(userId, lessonId, lessonData) {
    return this.logActivity(userId, 'lesson_completion', {
      lesson_id: lessonId,
      ...lessonData
    });
  }

  // Log practice completion
  async logPracticeCompletion(userId, questionId, practiceData) {
    return this.logActivity(userId, 'practice_completion', {
      question_id: questionId,
      ...practiceData
    });
  }

  // Log tutor session
  async logTutorSession(userId, conversationId, tutorData) {
    return this.logActivity(userId, 'tutor_session', {
      conversation_id: conversationId,
      ...tutorData
    });
  }

  // Log study plan progress
  async logStudyPlanProgress(userId, planId, dayNumber, progressData) {
    return this.logActivity(userId, 'plan_progress', {
      plan_id: planId,
      day_number: dayNumber,
      ...progressData
    });
  }
}

export const trackingService = new TrackingService();