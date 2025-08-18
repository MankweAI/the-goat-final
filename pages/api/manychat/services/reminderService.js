/**
 * Reminder Scheduling Service
 * Date: 2025-08-18 11:23:50 UTC
 * Author: sophoniagoat
 *
 * Manages scheduling and sending of study plan reminders
 */

import { executeQuery } from '../config/database.js';
import { updateUser } from './userService.js';

export class ReminderService {
  /**
   * Schedule daily reminders for a study plan
   *
   * @param {string} userId - User ID
   * @param {Object} studyPlan - Study plan object
   * @param {string} preferredTime - User's preferred time (HH:MM format)
   * @returns {boolean} Success status
   */
  async scheduleReminders(userId, studyPlan, preferredTime) {
    try {
      console.log(`📅 Scheduling reminders for user ${userId} at ${preferredTime}`);

      // Parse preferred time
      const [hours, minutes] = this.parsePreferredTime(preferredTime);

      // Create a reminder for each day in the plan
      const planData = studyPlan.plan_data;
      if (!planData || !planData.days || planData.days.length === 0) {
        console.error('❌ Invalid study plan data for reminders');
        return false;
      }

      // Delete any existing reminders for this plan
      await this.deleteExistingReminders(userId, studyPlan.id);

      // Schedule new reminders
      for (const day of planData.days) {
        // Parse date from plan
        const reminderDate = new Date(day.date);

        // Set time to user's preferred time
        reminderDate.setHours(hours);
        reminderDate.setMinutes(minutes);

        // Don't schedule if in the past
        if (reminderDate < new Date()) {
          continue;
        }

        // Create reminder
        await this.createReminderRecord(
          userId,
          studyPlan.id,
          day.day,
          reminderDate,
          day.engagement_hooks.reminder_message
        );
      }

      console.log(`✅ Scheduled ${planData.days.length} reminders for user ${userId}`);

      // Update user's reminder preferences
      await updateUser(userId, {
        has_active_reminders: true,
        preferred_reminder_time: preferredTime
      });

      return true;
    } catch (error) {
      console.error('❌ Reminder scheduling error:', error);
      return false;
    }
  }

  /**
   * Parse preferred time string into hours and minutes
   */
  parsePreferredTime(timeString) {
    // Default to 7:00 PM
    let hours = 19;
    let minutes = 0;

    try {
      // Try HH:MM format
      if (timeString && timeString.includes(':')) {
        const [h, m] = timeString.split(':').map((n) => parseInt(n.trim()));
        if (!isNaN(h) && !isNaN(m)) {
          hours = h;
          minutes = m;
        }
      }
      // Try "X pm/am" format
      else if (timeString) {
        const match = timeString.match(/(\d+)(?::(\d+))?\s*(am|pm)?/i);
        if (match) {
          let h = parseInt(match[1]);
          const m = match[2] ? parseInt(match[2]) : 0;
          const period = match[3] ? match[3].toLowerCase() : null;

          // Convert to 24-hour format
          if (period === 'pm' && h < 12) h += 12;
          if (period === 'am' && h === 12) h = 0;

          if (!isNaN(h) && !isNaN(m)) {
            hours = h;
            minutes = m;
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Time parsing error, using default:', error);
    }

    return [hours, minutes];
  }

  /**
   * Delete existing reminders for a study plan
   */
  async deleteExistingReminders(userId, planId) {
    return executeQuery(async (supabase) => {
      const { error } = await supabase
        .from('study_reminders')
        .delete()
        .eq('user_id', userId)
        .eq('study_plan_id', planId);

      if (error) {
        console.error('❌ Error deleting existing reminders:', error);
      }
    });
  }

  /**
   * Create a reminder record in the database
   */
  async createReminderRecord(userId, planId, dayNumber, scheduledTime, message) {
    return executeQuery(async (supabase) => {
      const { error } = await supabase.from('study_reminders').insert({
        user_id: userId,
        study_plan_id: planId,
        day_number: dayNumber,
        scheduled_for: scheduledTime.toISOString(),
        message: message,
        status: 'scheduled',
        created_at: new Date().toISOString()
      });

      if (error) {
        console.error('❌ Reminder creation error:', error);
        throw error;
      }
    });
  }

  /**
   * Get pending reminders for a user
   */
  async getUserReminders(userId) {
    return executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('study_reminders')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'scheduled')
        .order('scheduled_for', { ascending: true });

      if (error) {
        console.error('❌ Reminder fetch error:', error);
        return [];
      }

      return data || [];
    });
  }

  /**
   * Mark a reminder as sent
   */
  async markReminderSent(reminderId) {
    return executeQuery(async (supabase) => {
      const { error } = await supabase
        .from('study_reminders')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', reminderId);

      if (error) {
        console.error('❌ Reminder update error:', error);
      }
    });
  }

  /**
   * Process due reminders (to be called by scheduler)
   */
  async processDueReminders() {
    try {
      console.log('⏰ Processing due reminders');

      const now = new Date();

      // Find reminders that are due
      const dueReminders = await executeQuery(async (supabase) => {
        const { data, error } = await supabase
          .from('study_reminders')
          .select('id, user_id, message, scheduled_for')
          .eq('status', 'scheduled')
          .lte('scheduled_for', now.toISOString())
          .order('scheduled_for', { ascending: true });

        if (error) {
          console.error('❌ Due reminders fetch error:', error);
          return [];
        }

        return data || [];
      });

      console.log(`📊 Found ${dueReminders.length} due reminders`);

      // Process each reminder
      for (const reminder of dueReminders) {
        try {
          // Send the reminder (implementation depends on messaging system)
          await this.sendReminderMessage(reminder.user_id, reminder.message);

          // Mark as sent
          await this.markReminderSent(reminder.id);

          console.log(`✅ Sent reminder ${reminder.id} to user ${reminder.user_id}`);
        } catch (error) {
          console.error(`❌ Error processing reminder ${reminder.id}:`, error);
        }
      }

      return dueReminders.length;
    } catch (error) {
      console.error('❌ Reminder processing error:', error);
      return 0;
    }
  }

  /**
   * Send reminder message to user
   * This is a placeholder - actual implementation will depend on messaging platform
   */
  async sendReminderMessage(userId, message) {
    // In a real implementation, this would call the messaging API
    console.log(`📱 [MOCK] Sending reminder to user ${userId}: ${message}`);

    // Return true to simulate successful sending
    return true;
  }

  /**
   * Cancel all reminders for a user
   */
  async cancelUserReminders(userId) {
    return executeQuery(async (supabase) => {
      const { error } = await supabase
        .from('study_reminders')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('status', 'scheduled');

      if (error) {
        console.error('❌ Reminder cancellation error:', error);
        return false;
      }

      // Update user preferences
      await updateUser(userId, {
        has_active_reminders: false
      });

      return true;
    });
  }
}

export const reminderService = new ReminderService();

