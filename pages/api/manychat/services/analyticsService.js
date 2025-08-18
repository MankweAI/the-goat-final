/**
 * Analytics Service
 * Date: 2025-08-18 12:28:45 UTC
 * Author: sophoniagoat
 *
 * Provides analytics and reporting capabilities for the platform
 */

import { executeQuery } from '../config/database.js';
import { formatDate, formatTimeRemaining } from '../utils/dateFormatter.js';

export class AnalyticsService {
  /**
   * Get user study progress summary
   *
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Object} Progress summary
   */
  async getUserProgressSummary(userId, options = {}) {
    try {
      console.log(`📊 Generating progress summary for user ${userId}`);

      const { daysLookback = 7, includeTopics = true, includeUpcomingExam = true } = options;

      // Get start date for lookback period
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysLookback);

      // Get active study plan
      const activePlan = await this.getUserActivePlan(userId);

      // Get lesson completion stats
      const lessonStats = await this.getLessonCompletionStats(userId, startDate);

      // Get practice question stats
      const practiceStats = await this.getPracticeCompletionStats(userId, startDate);

      // Get topic performance
      const topicPerformance = includeTopics ? await this.getTopicPerformanceSummary(userId) : null;

      // Get upcoming exam info
      const upcomingExam = includeUpcomingExam ? await this.getUpcomingExamInfo(userId) : null;

      // Get study streak
      const streak = await this.getCurrentStudyStreak(userId);

      // Get total time spent
      const timeSpent = await this.getTotalTimeSpent(userId, startDate);

      return {
        user_id: userId,
        time_period: `Last ${daysLookback} days`,
        report_date: new Date().toISOString(),

        // Activity summary
        active_plan: activePlan
          ? {
              id: activePlan.id,
              subject: activePlan.subject,
              topics: activePlan.topics,
              total_days: activePlan.total_days,
              current_day: activePlan.current_day,
              completion_percentage: activePlan.completion_percentage
            }
          : null,

        // Lesson stats
        lessons_completed: lessonStats.completed,
        lessons_total: lessonStats.total,

        // Practice stats
        practice_completed: practiceStats.completed,
        practice_total: practiceStats.total,
        average_understanding: practiceStats.averageUnderstanding,

        // Topic performance
        topic_performance: topicPerformance,

        // Exam info
        upcoming_exam: upcomingExam,

        // Engagement metrics
        study_streak: streak,
        total_time_minutes: timeSpent,

        // Achievement indicators
        has_daily_goal_met: lessonStats.completed + practiceStats.completed >= 3,
        has_improvement_trend: practiceStats.hasImprovementTrend
      };
    } catch (error) {
      console.error('❌ Progress summary error:', error);
      return {
        user_id: userId,
        error: 'Failed to generate progress summary',
        report_date: new Date().toISOString()
      };
    }
  }

  /**
   * Format progress summary for WhatsApp display
   *
   * @param {Object} progressSummary - Progress summary data
   * @returns {string} Formatted progress summary
   */
  formatProgressSummary(progressSummary) {
    if (!progressSummary || progressSummary.error) {
      return `I couldn't generate your progress summary at this time. Please try again later.`;
    }

    let summary = `📊 **YOUR STUDY PROGRESS SUMMARY**\n\n`;

    // Add streak and time period
    summary += `🔥 Current streak: ${progressSummary.study_streak} day${progressSummary.study_streak !== 1 ? 's' : ''}\n`;
    summary += `⏱️ Time spent: ${Math.round(progressSummary.total_time_minutes / 60)} hours ${progressSummary.total_time_minutes % 60} minutes\n\n`;

    // Add active plan info if available
    if (progressSummary.active_plan) {
      const plan = progressSummary.active_plan;
      summary += `📝 **STUDY PLAN PROGRESS**\n`;
      summary += `Subject: ${plan.subject}\n`;
      summary += `Focus: ${plan.topics.join(', ')}\n`;
      summary += `Day ${plan.current_day} of ${plan.total_days}\n`;

      // Add progress bar
      const progressBar = this.generateProgressBar(plan.completion_percentage);
      summary += `Progress: ${progressBar} ${Math.round(plan.completion_percentage)}%\n\n`;
    }

    // Add upcoming exam info if available
    if (progressSummary.upcoming_exam) {
      const exam = progressSummary.upcoming_exam;
      summary += `📅 **UPCOMING TEST**\n`;
      summary += `Subject: ${exam.subject}\n`;
      summary += `Date: ${formatDate(exam.date)}\n`;
      summary += `Time remaining: ${formatTimeRemaining(exam.date)}\n\n`;
    }

    // Add activity summary
    summary += `📚 **ACTIVITY SUMMARY**\n`;
    summary += `Lessons completed: ${progressSummary.lessons_completed}\n`;
    summary += `Practice questions: ${progressSummary.practice_completed}\n`;

    if (progressSummary.average_understanding) {
      // Add star rating for understanding
      const understandingStars =
        '★'.repeat(Math.round(progressSummary.average_understanding)) +
        '☆'.repeat(5 - Math.round(progressSummary.average_understanding));
      summary += `Average understanding: ${understandingStars}\n\n`;
    } else {
      summary += `\n`;
    }

    // Add topic performance if available
    if (progressSummary.topic_performance && progressSummary.topic_performance.length > 0) {
      summary += `🧠 **TOPIC MASTERY**\n`;

      progressSummary.topic_performance.forEach((topic) => {
        const masteryLevel = this.getMasteryLevelEmoji(topic.mastery_level);
        summary += `${masteryLevel} ${topic.topic}: ${topic.mastery_percentage}%\n`;
      });

      summary += `\n`;
    }

    // Add achievements and suggestions
    summary += `✨ **INSIGHTS**\n`;

    if (progressSummary.has_daily_goal_met) {
      summary += `• You've met your daily study goal!\n`;
    }

    if (progressSummary.has_improvement_trend) {
      summary += `• Your understanding is improving!\n`;
    }

    if (progressSummary.topic_performance && progressSummary.topic_performance.length > 0) {
      // Find strongest and weakest topics
      const sortedTopics = [...progressSummary.topic_performance].sort(
        (a, b) => b.mastery_percentage - a.mastery_percentage
      );

      if (sortedTopics.length > 0) {
        summary += `• Strongest topic: ${sortedTopics[0].topic}\n`;

        if (sortedTopics.length > 1) {
          summary += `• Focus area: ${sortedTopics[sortedTopics.length - 1].topic}\n`;
        }
      }
    }

    // Add call to action
    summary += `\nReply "details" to see more stats or "practice" to continue studying.`;

    return summary;
  }

  /**
   * Generate ASCII progress bar
   *
   * @param {number} percentage - Percentage value (0-100)
   * @param {number} length - Bar length in characters
   * @returns {string} Progress bar
   */
  generateProgressBar(percentage, length = 10) {
    const filledLength = Math.round((percentage / 100) * length);
    const emptyLength = length - filledLength;

    return '█'.repeat(filledLength) + '▒'.repeat(emptyLength);
  }

  /**
   * Get emoji for mastery level
   *
   * @param {string} masteryLevel - Mastery level
   * @returns {string} Emoji
   */
  getMasteryLevelEmoji(masteryLevel) {
    const emojis = {
      beginner: '🌱',
      developing: '🌿',
      proficient: '🌲',
      advanced: '🌟',
      mastered: '🏆'
    };

    return emojis[masteryLevel] || '📌';
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

      if (!plan || !plan.plan_data) {
        return null;
      }

      // Calculate completion percentage
      const planData = plan.plan_data;
      const totalDays = planData.total_days || 0;
      const currentDay = plan.current_day || 1;

      // Count completed activities
      let completedActivities = 0;
      let totalActivities = 0;

      if (planData.days) {
        planData.days.forEach((day) => {
          if (day.lessons) {
            totalActivities += day.lessons.length;
            if (day.completed) {
              completedActivities += day.lessons.length;
            }
          }

          if (day.practice_questions) {
            totalActivities += day.practice_questions.length;
            if (day.completed) {
              completedActivities += day.practice_questions.length;
            }
          }
        });
      }

      const completionPercentage =
        totalActivities > 0
          ? (completedActivities / totalActivities) * 100
          : ((currentDay - 1) / totalDays) * 100;

      return {
        id: plan.id,
        subject: session.focus_subject || planData.subject || 'math',
        topics: session.focus_topics || planData.topics || [],
        total_days: totalDays,
        current_day: currentDay,
        completion_percentage: completionPercentage
      };
    });
  }

  /**
   * Get lesson completion statistics
   *
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date for lookback
   * @returns {Object} Lesson stats
   */
  async getLessonCompletionStats(userId, startDate) {
    return executeQuery(async (supabase) => {
      // Get lesson views since start date
      const { data: views, error } = await supabase
        .from('lesson_views')
        .select('id, viewed_at')
        .eq('user_id', userId)
        .gte('viewed_at', startDate.toISOString());

      if (error) {
        console.error('❌ Lesson views fetch error:', error);
        return { completed: 0, total: 0 };
      }

      // Get total available lessons
      const { count: totalLessons, error: countError } = await supabase
        .from('lessons')
        .select('id', { count: 'exact', head: true });

      if (countError) {
        console.error('❌ Lesson count error:', countError);
        return { completed: 0, total: 0 };
      }

      return {
        completed: views?.length || 0,
        total: totalLessons || 0
      };
    });
  }

  /**
   * Get practice question completion statistics
   *
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date for lookback
   * @returns {Object} Practice stats
   */
  async getPracticeCompletionStats(userId, startDate) {
    return executeQuery(async (supabase) => {
      // Get completed practice attempts since start date
      const { data: attempts, error } = await supabase
        .from('practice_attempts')
        .select('id, understanding_rating, completed_at')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('completed_at', startDate.toISOString());

      if (error) {
        console.error('❌ Practice attempts fetch error:', error);
        return {
          completed: 0,
          total: 0,
          averageUnderstanding: null,
          hasImprovementTrend: false
        };
      }

      // Get total available practice questions
      const { count: totalQuestions, error: countError } = await supabase
        .from('practice_questions')
        .select('id', { count: 'exact', head: true });

      if (countError) {
        console.error('❌ Question count error:', countError);
        return {
          completed: 0,
          total: 0,
          averageUnderstanding: null,
          hasImprovementTrend: false
        };
      }

      // Calculate average understanding
      let averageUnderstanding = null;
      let hasImprovementTrend = false;

      if (attempts && attempts.length > 0) {
        const ratings = attempts
          .filter((a) => a.understanding_rating !== null)
          .map((a) => a.understanding_rating);

        if (ratings.length > 0) {
          averageUnderstanding = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;

          // Check for improvement trend
          if (ratings.length >= 3) {
            // Sort by completion date
            const sortedAttempts = [...attempts]
              .filter((a) => a.understanding_rating !== null)
              .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));

            // Split into halves and compare averages
            const halfIndex = Math.floor(sortedAttempts.length / 2);
            const firstHalf = sortedAttempts.slice(0, halfIndex);
            const secondHalf = sortedAttempts.slice(halfIndex);

            const firstHalfAvg =
              firstHalf.reduce((sum, a) => sum + a.understanding_rating, 0) / firstHalf.length;
            const secondHalfAvg =
              secondHalf.reduce((sum, a) => sum + a.understanding_rating, 0) / secondHalf.length;

            hasImprovementTrend = secondHalfAvg > firstHalfAvg;
          }
        }
      }

      return {
        completed: attempts?.length || 0,
        total: totalQuestions || 0,
        averageUnderstanding,
        hasImprovementTrend
      };
    });
  }

  /**
   * Get topic performance summary
   *
   * @param {string} userId - User ID
   * @returns {Array} Topic performance data
   */
  async getTopicPerformanceSummary(userId) {
    return executeQuery(async (supabase) => {
      // Get topic performance records
      const { data, error } = await supabase
        .from('topic_performance')
        .select('*')
        .eq('user_id', userId)
        .order('last_practiced_at', { ascending: false });

      if (error) {
        console.error('❌ Topic performance fetch error:', error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Transform data for summary
      return data.map((tp) => {
        // Calculate mastery percentage based on average understanding
        const masteryPercentage = tp.average_understanding
          ? Math.round((tp.average_understanding / 5) * 100)
          : Math.min(Math.round((tp.completed_count / Math.max(tp.attempts_count, 1)) * 100), 100);

        // Determine mastery level
        let masteryLevel;
        if (masteryPercentage >= 90) masteryLevel = 'mastered';
        else if (masteryPercentage >= 75) masteryLevel = 'advanced';
        else if (masteryPercentage >= 60) masteryLevel = 'proficient';
        else if (masteryPercentage >= 40) masteryLevel = 'developing';
        else masteryLevel = 'beginner';

        return {
          topic: tp.topic,
          attempts_count: tp.attempts_count || 0,
          completed_count: tp.completed_count || 0,
          mastery_percentage: masteryPercentage,
          mastery_level: masteryLevel,
          strengths: tp.strengths || [],
          weaknesses: tp.weaknesses || [],
          last_practiced: tp.last_practiced_at
        };
      });
    });
  }

  /**
   * Get upcoming exam information
   *
   * @param {string} userId - User ID
   * @returns {Object} Exam information
   */
  async getUpcomingExamInfo(userId) {
    return executeQuery(async (supabase) => {
      // Get active exam prep session
      const { data, error } = await supabase
        .from('exam_prep_sessions')
        .select('focus_subject, exam_date')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data || !data.exam_date) {
        return null;
      }

      return {
        subject: data.focus_subject || 'math',
        date: data.exam_date
      };
    });
  }

  /**
   * Get current study streak
   *
   * @param {string} userId - User ID
   * @returns {number} Streak count in days
   */
  async getCurrentStudyStreak(userId) {
    try {
      // Get user activity log ordered by date
      const activityLog = await this.getUserActivityLog(userId);

      if (!activityLog || activityLog.length === 0) {
        return 0;
      }

      // Calculate streak
      let streak = 0;
      let currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0); // Start of today

      // Check if there's activity today
      const todayActivity = activityLog.find((a) => {
        const activityDate = new Date(a.activity_date);
        activityDate.setHours(0, 0, 0, 0);
        return activityDate.getTime() === currentDate.getTime();
      });

      // If no activity today, start checking from yesterday
      if (!todayActivity) {
        currentDate.setDate(currentDate.getDate() - 1);
      }

      // Iterate backwards through days
      while (true) {
        // Find activity for current date
        const dateActivity = activityLog.find((a) => {
          const activityDate = new Date(a.activity_date);
          activityDate.setHours(0, 0, 0, 0);
          return activityDate.getTime() === currentDate.getTime();
        });

        // If no activity found, break
        if (!dateActivity) {
          break;
        }

        // Increment streak and move to previous day
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      }

      return streak;
    } catch (error) {
      console.error('❌ Streak calculation error:', error);
      return 0;
    }
  }

  /**
   * Get user activity log
   *
   * @param {string} userId - User ID
   * @returns {Array} Activity log
   */
  async getUserActivityLog(userId) {
    return executeQuery(async (supabase) => {
      // Combine activity from various tables

      // Get lesson views
      const { data: lessonViews, error: lessonError } = await supabase
        .from('lesson_views')
        .select('viewed_at')
        .eq('user_id', userId)
        .order('viewed_at', { ascending: false });

      // Get practice attempts
      const { data: practiceAttempts, error: practiceError } = await supabase
        .from('practice_attempts')
        .select('started_at')
        .eq('user_id', userId)
        .order('started_at', { ascending: false });

      // Get tutor conversations
      const { data: tutorConversations, error: tutorError } = await supabase
        .from('tutor_conversations')
        .select('started_at')
        .eq('user_id', userId)
        .order('started_at', { ascending: false });

      // Combine all activities
      const activities = [];

      if (lessonViews && !lessonError) {
        lessonViews.forEach((view) => {
          activities.push({
            activity_type: 'lesson_view',
            activity_date: view.viewed_at
          });
        });
      }

      if (practiceAttempts && !practiceError) {
        practiceAttempts.forEach((attempt) => {
          activities.push({
            activity_type: 'practice_attempt',
            activity_date: attempt.started_at
          });
        });
      }

      if (tutorConversations && !tutorError) {
        tutorConversations.forEach((conv) => {
          activities.push({
            activity_type: 'tutor_conversation',
            activity_date: conv.started_at
          });
        });
      }

      return activities;
    });
  }

  /**
   * Get total time spent studying
   *
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date for lookback
   * @returns {number} Time spent in minutes
   */
  async getTotalTimeSpent(userId, startDate) {
    try {
      let totalMinutes = 0;

      // Get tutor conversation time
      const tutorTime = await executeQuery(async (supabase) => {
        const { data, error } = await supabase
          .from('tutor_conversations')
          .select('duration_minutes')
          .eq('user_id', userId)
          .gte('started_at', startDate.toISOString());

        if (error || !data) {
          return 0;
        }

        return data.reduce((sum, conv) => sum + (conv.duration_minutes || 0), 0);
      });

      totalMinutes += tutorTime;

      // Estimate lesson time (5 minutes per lesson)
      const lessonViews = await executeQuery(async (supabase) => {
        const { data, error } = await supabase
          .from('lesson_views')
          .select('id')
          .eq('user_id', userId)
          .gte('viewed_at', startDate.toISOString());

        if (error || !data) {
          return 0;
        }

        return data.length * 5; // 5 minutes per lesson
      });

      totalMinutes += lessonViews;

      // Estimate practice time (3 minutes per practice)
      const practiceTime = await executeQuery(async (supabase) => {
        const { data, error } = await supabase
          .from('practice_attempts')
          .select('id')
          .eq('user_id', userId)
          .gte('started_at', startDate.toISOString());

        if (error || !data) {
          return 0;
        }

        return data.length * 3; // 3 minutes per practice
      });

      totalMinutes += practiceTime;

      return totalMinutes;
    } catch (error) {
      console.error('❌ Time calculation error:', error);
      return 0;
    }
  }

  /**
   * Get detailed topic report
   *
   * @param {string} userId - User ID
   * @param {string} topic - Topic name
   * @returns {Object} Topic report
   */
  async getTopicReport(userId, topic) {
    try {
      console.log(`📊 Generating topic report for user ${userId}, topic ${topic}`);

      // Get topic performance
      const topicPerformance = await executeQuery(async (supabase) => {
        const { data, error } = await supabase
          .from('topic_performance')
          .select('*')
          .eq('user_id', userId)
          .eq('topic', topic)
          .single();

        if (error) {
          console.error('❌ Topic performance fetch error:', error);
          return null;
        }

        return data;
      });

      if (!topicPerformance) {
        return {
          user_id: userId,
          topic,
          error: 'No data available for this topic',
          report_date: new Date().toISOString()
        };
      }

      // Get practice attempts for this topic
      const practiceAttempts = await executeQuery(async (supabase) => {
        const { data, error } = await supabase
          .from('practice_attempts')
          .select(
            `
            id,
            understanding_rating,
            understanding_level,
            hints_used,
            concepts_demonstrated,
            misconceptions,
            completed_at,
            status,
            practice_questions (
              id,
              topic,
              difficulty
            )
          `
          )
          .eq('user_id', userId)
          .order('completed_at', { ascending: false });

        if (error) {
          console.error('❌ Practice attempts fetch error:', error);
          return [];
        }

        // Filter to this topic
        return (data || []).filter(
          (a) => a.practice_questions && a.practice_questions.topic === topic
        );
      });

      // Get lessons viewed for this topic
      const lessonViews = await executeQuery(async (supabase) => {
        const { data, error } = await supabase
          .from('lesson_views')
          .select(
            `
            id,
            viewed_at,
            lessons (
              id,
              title,
              topic
            )
          `
          )
          .eq('user_id', userId)
          .order('viewed_at', { ascending: false });

        if (error) {
          console.error('❌ Lesson views fetch error:', error);
          return [];
        }

        // Filter to this topic
        return (data || []).filter((v) => v.lessons && v.lessons.topic === topic);
      });

      // Calculate statistics
      const completedAttempts = practiceAttempts.filter((a) => a.status === 'completed');
      const averageUnderstanding =
        completedAttempts.length > 0
          ? completedAttempts.reduce((sum, a) => sum + (a.understanding_rating || 0), 0) /
            completedAttempts.length
          : 0;

      // Calculate understanding by difficulty
      const understandingByDifficulty = {
        easy: { count: 0, sum: 0 },
        medium: { count: 0, sum: 0 },
        hard: { count: 0, sum: 0 }
      };

      completedAttempts.forEach((a) => {
        if (a.understanding_rating && a.practice_questions.difficulty) {
          const difficulty = a.practice_questions.difficulty;
          understandingByDifficulty[difficulty].count++;
          understandingByDifficulty[difficulty].sum += a.understanding_rating;
        }
      });

      // Calculate averages
      Object.keys(understandingByDifficulty).forEach((difficulty) => {
        const data = understandingByDifficulty[difficulty];
        understandingByDifficulty[difficulty].average = data.count > 0 ? data.sum / data.count : 0;
      });

      // Extract common misconceptions
      const misconceptions = [];
      completedAttempts.forEach((a) => {
        if (a.misconceptions) {
          misconceptions.push(...a.misconceptions);
        }
      });

      // Count occurrences
      const misconceptionCounts = {};
      misconceptions.forEach((m) => {
        misconceptionCounts[m] = (misconceptionCounts[m] || 0) + 1;
      });

      // Sort by frequency
      const commonMisconceptions = Object.keys(misconceptionCounts)
        .map((m) => ({ misconception: m, count: misconceptionCounts[m] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Create report
      return {
        user_id: userId,
        topic,
        report_date: new Date().toISOString(),

        // Performance overview
        attempts_count: practiceAttempts.length,
        completed_count: completedAttempts.length,
        lessons_viewed: lessonViews.length,
        average_understanding: averageUnderstanding,
        mastery_percentage: topicPerformance.average_understanding
          ? Math.round((topicPerformance.average_understanding / 5) * 100)
          : Math.min(
              Math.round(
                (topicPerformance.completed_count / Math.max(topicPerformance.attempts_count, 1)) *
                  100
              ),
              100
            ),

        // Understanding by difficulty
        understanding_by_difficulty: {
          easy: understandingByDifficulty.easy.average,
          medium: understandingByDifficulty.medium.average,
          hard: understandingByDifficulty.hard.average
        },

        // Strengths and weaknesses
        strengths: topicPerformance.strengths || [],
        weaknesses: topicPerformance.weaknesses || [],
        common_misconceptions: commonMisconceptions,

        // Recent activity
        recent_lessons: lessonViews.slice(0, 3).map((v) => ({
          lesson_id: v.lessons.id,
          title: v.lessons.title,
          viewed_at: v.viewed_at
        })),

        recent_practice: completedAttempts.slice(0, 3).map((a) => ({
          question_id: a.practice_questions.id,
          difficulty: a.practice_questions.difficulty,
          understanding: a.understanding_rating,
          completed_at: a.completed_at
        }))
      };
    } catch (error) {
      console.error('❌ Topic report error:', error);
      return {
        user_id: userId,
        topic,
        error: 'Failed to generate topic report',
        report_date: new Date().toISOString()
      };
    }
  }

  /**
   * Format topic report for WhatsApp display
   *
   * @param {Object} topicReport - Topic report data
   * @returns {string} Formatted topic report
   */
  formatTopicReport(topicReport) {
    if (!topicReport || topicReport.error) {
      return `I couldn't generate a detailed report for this topic. You may need to complete more practice questions first.`;
    }

    let report = `📊 **${topicReport.topic.toUpperCase()} DETAILED REPORT**\n\n`;

    // Add mastery overview
    const masteryPercentage = topicReport.mastery_percentage;
    let masteryLevel = '';

    if (masteryPercentage >= 90) masteryLevel = 'Mastered';
    else if (masteryPercentage >= 75) masteryLevel = 'Advanced';
    else if (masteryPercentage >= 60) masteryLevel = 'Proficient';
    else if (masteryPercentage >= 40) masteryLevel = 'Developing';
    else masteryLevel = 'Beginner';

    const progressBar = this.generateProgressBar(masteryPercentage);
    report += `Mastery: ${progressBar} ${Math.round(masteryPercentage)}%\n`;
    report += `Level: ${masteryLevel}\n\n`;

    // Add activity summary
    report += `**ACTIVITY SUMMARY**\n`;
    report += `Questions attempted: ${topicReport.attempts_count}\n`;
    report += `Questions completed: ${topicReport.completed_count}\n`;
    report += `Lessons viewed: ${topicReport.lessons_viewed}\n\n`;

    // Add understanding by difficulty if available
    const understandingByDifficulty = topicReport.understanding_by_difficulty;
    if (understandingByDifficulty) {
      report += `**UNDERSTANDING BY DIFFICULTY**\n`;

      // Only show difficulties with data
      if (understandingByDifficulty.easy > 0) {
        report += `Easy: ${'★'.repeat(Math.round(understandingByDifficulty.easy))}\n`;
      }

      if (understandingByDifficulty.medium > 0) {
        report += `Medium: ${'★'.repeat(Math.round(understandingByDifficulty.medium))}\n`;
      }

      if (understandingByDifficulty.hard > 0) {
        report += `Hard: ${'★'.repeat(Math.round(understandingByDifficulty.hard))}\n`;
      }

      report += `\n`;
    }

    // Add strengths and weaknesses
    if (topicReport.strengths && topicReport.strengths.length > 0) {
      report += `**STRENGTHS**\n`;
      topicReport.strengths.slice(0, 3).forEach((s) => {
        report += `• ${s}\n`;
      });
      report += `\n`;
    }

    if (topicReport.weaknesses && topicReport.weaknesses.length > 0) {
      report += `**AREAS TO IMPROVE**\n`;
      topicReport.weaknesses.slice(0, 3).forEach((w) => {
        report += `• ${w}\n`;
      });
      report += `\n`;
    }

    // Add common misconceptions
    if (topicReport.common_misconceptions && topicReport.common_misconceptions.length > 0) {
      report += `**COMMON MISCONCEPTIONS**\n`;
      topicReport.common_misconceptions.slice(0, 3).forEach((m) => {
        report += `• ${m.misconception}\n`;
      });
      report += `\n`;
    }

    // Add recent lessons
    if (topicReport.recent_lessons && topicReport.recent_lessons.length > 0) {
      report += `**RECENT LESSONS**\n`;
      topicReport.recent_lessons.forEach((lesson) => {
        const date = formatDate(lesson.viewed_at, { shortMonth: true });
        report += `• ${lesson.title} (${date})\n`;
      });
      report += `\n`;
    }

    // Add recommendations
    report += `**RECOMMENDATIONS**\n`;

    if (topicReport.weaknesses && topicReport.weaknesses.length > 0) {
      report += `• Focus on improving your understanding of ${topicReport.weaknesses[0]}\n`;
    }

    if (topicReport.understanding_by_difficulty) {
      // Find the lowest difficulty level
      const difficulties = Object.entries(topicReport.understanding_by_difficulty);
      difficulties.sort((a, b) => a[1] - b[1]);

      if (difficulties.length > 0 && difficulties[0][1] > 0) {
        report += `• Practice more ${difficulties[0][0]} difficulty questions\n`;
      }
    }

    report += `• Complete at least 5 more practice questions in this topic\n`;

    if (topicReport.lessons_viewed < 3) {
      report += `• Review more lessons on ${topicReport.topic}\n`;
    }

    // Add call to action
    report += `\nReply "practice ${topicReport.topic}" to work on this topic now.`;

    return report;
  }

  /**
   * Get user performance dashboard URL
   *
   * @param {string} userId - User ID
   * @returns {string} Dashboard URL
   */
  async getDashboardUrl(userId) {
    // In a real implementation, this would generate a secure URL to a web dashboard
    // For this demo, we'll just return a placeholder
    return `https://app.examprep.edu/dashboard/${userId}`;
  }
}

export const analyticsService = new AnalyticsService();
