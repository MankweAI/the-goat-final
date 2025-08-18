/**
 * Study Plan Handler
 * Date: 2025-08-18 11:23:50 UTC
 * Author: sophoniagoat
 *
 * Handles user interactions with study plans
 */

import { executeQuery } from '../config/database.js';
import { updateUser } from '../services/userService.js';
import { studyPlanService } from '../services/studyPlanService.js';
import { reminderService } from '../services/reminderService.js';
import { conversationalExamPrepHandler } from './conversationalExamPrepHandler.js';
import { MESSAGES } from '../config/constants.js';

export const studyPlanHandler = {
  /**
   * Generate and show study plan based on collected user info
   */
  async generateStudyPlan(user, session) {
    try {
      console.log(`📝 Generating study plan for user ${user.id}, session ${session.id}`);

      // Generate the study plan
      const studyPlan = await studyPlanService.generateStudyPlan(user, session);

      // Update session with plan information
      await this.updateSessionWithPlan(session.id, studyPlan.id);

      // Schedule reminders if preferred time is available
      if (session.preferred_time) {
        await reminderService.scheduleReminders(user.id, studyPlan, session.preferred_time);
      }

      // Visualize plan for user
      const planVisualization = studyPlanService.visualizeStudyPlan(studyPlan);

      console.log(`✅ Study plan generated and visualized for user ${user.id}`);

      return planVisualization;
    } catch (error) {
      console.error('❌ Study plan generation error:', error);
      return this.getStudyPlanErrorMessage();
    }
  },

  /**
   * Update exam prep session with study plan info
   */
  async updateSessionWithPlan(sessionId, planId) {
    return executeQuery(async (supabase) => {
      const { error } = await supabase
        .from('exam_prep_sessions')
        .update({
          study_plan_id: planId,
          session_state: {
            step: 'plan_created',
            plan_created_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) {
        console.error('❌ Session update error:', error);
      }
    });
  },

  /**
   * Handle user action on study plan
   */
  async handleStudyPlanAction(user, action) {
    try {
      console.log(`🎯 Study plan action: ${action} from user ${user.id}`);

      // Get current session and plan
      const { session, plan } = await this.getUserActivePlan(user.id);

      if (!session || !plan) {
        return `I can't find your active study plan. Let's create a new one!\n\n${MESSAGES.WELCOME.MAIN_MENU}`;
      }

      switch (action) {
        case 'start':
          return await this.startTodaysStudySession(user, session, plan);

        case 'view_plan':
          return studyPlanService.visualizeStudyPlan(plan, this.getCurrentPlanDay(plan));

        case 'skip_day':
          return await this.skipToNextDay(user, session, plan);

        case 'cancel_plan':
          return await this.cancelStudyPlan(user, session, plan);

        default:
          return `I didn't understand that action. Reply "start" to begin today's study session, or "view_plan" to see your full plan.`;
      }
    } catch (error) {
      console.error('❌ Study plan action error:', error);
      return `I'm having trouble processing that action. Please try again or type "menu" to return to the main menu.`;
    }
  },

  /**
   * Get user's active exam prep session and study plan
   */
  async getUserActivePlan(userId) {
    return executeQuery(async (supabase) => {
      // Get active session
      const { data: session } = await supabase
        .from('exam_prep_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!session || !session.study_plan_id) {
        return { session, plan: null };
      }

      // Get study plan
      const { data: plan } = await supabase
        .from('study_plans')
        .select('*')
        .eq('id', session.study_plan_id)
        .eq('is_active', true)
        .single();

      return { session, plan };
    });
  },

  /**
   * Start today's study session
   */
  async startTodaysStudySession(user, session, plan) {
    try {
      // Get current day in plan
      const currentDay = this.getCurrentPlanDay(plan);
      const planData = plan.plan_data;

      // Get today's plan
      const todayPlan = planData.days.find((d) => d.day === currentDay);
      if (!todayPlan) {
        return `I can't find today's study plan. Let's view your full plan instead.\n\n${studyPlanService.visualizeStudyPlan(plan, currentDay)}`;
      }

      // Update user state
      await updateUser(user.id, {
        current_menu: 'study_session',
        current_day: currentDay,
        last_active_at: new Date().toISOString()
      });

      // Start with first lesson
      if (todayPlan.lessons && todayPlan.lessons.length > 0) {
        // Mark session as started
        await this.markDaySessionStarted(plan.id, currentDay);

        // Return first lesson
        return this.formatLesson(todayPlan.lessons[0], currentDay, 1, todayPlan.lessons.length);
      } else {
        // No lessons, go straight to practice
        return this.startPracticeQuestions(user, session, plan, currentDay);
      }
    } catch (error) {
      console.error('❌ Study session start error:', error);
      return `I'm having trouble starting your study session. Please try again or type "menu" to return to the main menu.`;
    }
  },

  /**
   * Format lesson for display
   */
  formatLesson(lesson, day, lessonNumber, totalLessons) {
    return (
      `📚 **DAY ${day} - LESSON ${lessonNumber}/${totalLessons}**\n\n` +
      `**${lesson.title}**\n\n` +
      `${lesson.content}\n\n` +
      `Type "next" when you're ready to continue!`
    );
  },

  /**
   * Start practice questions after lessons
   */
  async startPracticeQuestions(user, session, plan, day) {
    try {
      // Get today's plan
      const planData = plan.plan_data;
      const todayPlan = planData.days.find((d) => d.day === day);

      if (
        !todayPlan ||
        !todayPlan.practice_questions ||
        todayPlan.practice_questions.length === 0
      ) {
        return this.completeStudyDay(user, session, plan, day);
      }

      // Update user state
      await updateUser(user.id, {
        current_menu: 'practice_session',
        current_question_index: 0,
        last_active_at: new Date().toISOString()
      });

      // Return first question
      return this.formatPracticeQuestion(
        todayPlan.practice_questions[0],
        day,
        1,
        todayPlan.practice_questions.length
      );
    } catch (error) {
      console.error('❌ Practice start error:', error);
      return `I'm having trouble starting your practice questions. Please try again or type "menu" to return to the main menu.`;
    }
  },

  /**
   * Format practice question for display
   */
  formatPracticeQuestion(question, day, questionNumber, totalQuestions) {
    return (
      `🧮 **DAY ${day} - PRACTICE ${questionNumber}/${totalQuestions}**\n\n` +
      `${question.question_text}\n\n` +
      `Think about your approach to this problem. When you're ready for the solution, type "solution".\n\n` +
      `If you'd like to try another question instead, type "next".`
    );
  },

  /**
   * Show solution for practice question
   */
  formatQuestionSolution(question, day, questionNumber, totalQuestions) {
    return (
      `✅ **DAY ${day} - SOLUTION ${questionNumber}/${totalQuestions}**\n\n` +
      `${question.solution_steps}\n\n` +
      `On a scale of 1-5, how confident do you feel with this type of problem?\n\n` +
      `1️⃣ Not confident at all\n` +
      `2️⃣ Slightly confident\n` +
      `3️⃣ Moderately confident\n` +
      `4️⃣ Very confident\n` +
      `5️⃣ Extremely confident`
    );
  },

  /**
   * Complete study day and show summary
   */
  async completeStudyDay(user, session, plan, day) {
    try {
      // Mark day as completed
      await this.markDayCompleted(plan.id, day);

      // Update user state
      await updateUser(user.id, {
        current_menu: 'study_completed',
        last_active_at: new Date().toISOString()
      });

      // Get completion message
      const planData = plan.plan_data;
      const todayPlan = planData.days.find((d) => d.day === day);
      const completionMessage =
        todayPlan?.engagement_hooks?.completion_message ||
        `Great job completing Day ${day} of your study plan!`;

      // Check if plan is complete
      const isLastDay = day >= planData.total_days;

      if (isLastDay) {
        // Entire plan completed
        return (
          `${completionMessage}\n\n` +
          `🎉 **CONGRATULATIONS!** 🎉\n\n` +
          `You've completed your entire study plan! You should feel confident and prepared for your upcoming test.\n\n` +
          `Want some last-minute practice? Type "practice" to continue with targeted questions.\n\n` +
          `Good luck on your test! 🍀`
        );
      } else {
        // More days left
        const nextDay = day + 1;
        const nextPlan = planData.days.find((d) => d.day === nextDay);
        const nextFocus = nextPlan?.focus || 'general concepts';

        return (
          `${completionMessage}\n\n` +
          `✅ **DAY ${day} COMPLETE!**\n\n` +
          `Tomorrow (Day ${nextDay}), we'll focus on: ${nextFocus}\n\n` +
          `Your next scheduled session will be sent at your preferred time.\n\n` +
          `Want to get ahead? Type "next_day" to start tomorrow's session early!`
        );
      }
    } catch (error) {
      console.error('❌ Day completion error:', error);
      return `Great job today! Your study session is complete. Type "menu" to return to the main menu.`;
    }
  },

  /**
   * Skip to next day in plan
   */
  async skipToNextDay(user, session, plan) {
    try {
      // Get current day
      const currentDay = this.getCurrentPlanDay(plan);
      const planData = plan.plan_data;

      // Check if we're already at the end
      if (currentDay >= planData.total_days) {
        return `You've already reached the last day of your study plan! Type "start" to review the final day's content again.`;
      }

      // Mark current day as completed if not already
      await this.markDayCompleted(plan.id, currentDay);

      // Get next day
      const nextDay = currentDay + 1;

      // Update user state
      await updateUser(user.id, {
        current_day: nextDay,
        last_active_at: new Date().toISOString()
      });

      // Show next day's plan
      return `Skipping to Day ${nextDay}...\n\n${studyPlanService.visualizeStudyPlan(plan, nextDay)}`;
    } catch (error) {
      console.error('❌ Day skip error:', error);
      return `I'm having trouble skipping to the next day. Please try again or type "menu" to return to the main menu.`;
    }
  },

  /**
   * Cancel study plan
   */
  async cancelStudyPlan(user, session, plan) {
    try {
      // Deactivate plan
      await executeQuery(async (supabase) => {
        await supabase
          .from('study_plans')
          .update({
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', plan.id);
      });

      // Cancel reminders
      await reminderService.cancelUserReminders(user.id);

      // Update session state
      await executeQuery(async (supabase) => {
        await supabase
          .from('exam_prep_sessions')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('id', session.id);
      });

      // Update user state
      await updateUser(user.id, {
        current_menu: 'welcome',
        has_active_reminders: false,
        exam_prep_session_id: null,
        last_active_at: new Date().toISOString()
      });

      return `Your study plan has been cancelled and reminders have been turned off.\n\n${MESSAGES.WELCOME.MAIN_MENU}`;
    } catch (error) {
      console.error('❌ Plan cancellation error:', error);
      return `I'm having trouble cancelling your plan. Please try again or type "menu" to return to the main menu.`;
    }
  },

  /**
   * Get current day in the plan
   */
  getCurrentPlanDay(plan) {
    try {
      // Check if user has a current_day set
      if (plan.current_day && plan.current_day > 0) {
        return plan.current_day;
      }

      // Otherwise calculate based on start date
      const planData = plan.plan_data;
      if (!planData || !planData.days || planData.days.length === 0) {
        return 1; // Default to day 1
      }

      const now = new Date();

      // Find the current day based on dates
      for (let i = 0; i < planData.days.length; i++) {
        const dayDate = new Date(planData.days[i].date);
        const nextDayDate =
          i < planData.days.length - 1
            ? new Date(planData.days[i + 1].date)
            : new Date(8640000000000000); // Max date

        if (now >= dayDate && now < nextDayDate) {
          return planData.days[i].day;
        }
      }

      // If we're before the first day
      if (now < new Date(planData.days[0].date)) {
        return 1;
      }

      // If we're after the last day
      return planData.days.length;
    } catch (error) {
      console.error('❌ Current day calculation error:', error);
      return 1; // Default to day 1
    }
  },

  /**
   * Mark a day's session as started
   */
  async markDaySessionStarted(planId, day) {
    return executeQuery(async (supabase) => {
      // Get current plan
      const { data: plan } = await supabase
        .from('study_plans')
        .select('plan_data')
        .eq('id', planId)
        .single();

      if (!plan || !plan.plan_data) return;

      // Update the day's status
      const planData = plan.plan_data;
      const dayIndex = planData.days.findIndex((d) => d.day === day);

      if (dayIndex >= 0) {
        planData.days[dayIndex].started = true;
        planData.days[dayIndex].started_at = new Date().toISOString();

        // Save updated plan
        await supabase
          .from('study_plans')
          .update({
            plan_data: planData,
            updated_at: new Date().toISOString()
          })
          .eq('id', planId);
      }
    });
  },

  /**
   * Mark a day as completed
   */
  async markDayCompleted(planId, day) {
    return executeQuery(async (supabase) => {
      // Get current plan
      const { data: plan } = await supabase
        .from('study_plans')
        .select('plan_data')
        .eq('id', planId)
        .single();

      if (!plan || !plan.plan_data) return;

      // Update the day's status
      const planData = plan.plan_data;
      const dayIndex = planData.days.findIndex((d) => d.day === day);

      if (dayIndex >= 0) {
        planData.days[dayIndex].completed = true;
        planData.days[dayIndex].completed_at = new Date().toISOString();

        // Save updated plan
        await supabase
          .from('study_plans')
          .update({
            plan_data: planData,
            current_day: day, // Store the last completed day
            updated_at: new Date().toISOString()
          })
          .eq('id', planId);
      }
    });
  },

  /**
   * Get error message for study plan generation
   */
  getStudyPlanErrorMessage() {
    return (
      `I'm having trouble creating your detailed study plan right now.\n\n` +
      `Let's start with a simple approach instead:\n\n` +
      `1. Review key concepts each day\n` +
      `2. Practice example problems\n` +
      `3. Test yourself with questions\n\n` +
      `Type "start" to begin with today's lesson!`
    );
  }
};
