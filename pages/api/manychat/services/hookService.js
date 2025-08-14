import { executeQuery } from '../config/database.js';

export class HookService {
  async getHookForUser(userId, hookType, context = {}) {
    return executeQuery(async (supabase) => {
      // Get user info for personalization
      const { data: user } = await supabase
        .from('users')
        .select('username, display_name, streak_count, last_active_at, total_questions_answered')
        .eq('id', userId)
        .single();

      if (!user) throw new Error('User not found');

      // Find appropriate hook template
      const { data: templates } = await supabase
        .from('hook_templates')
        .select('*')
        .eq('hook_type', hookType)
        .eq('is_active', true)
        .order('priority_level', { ascending: false });

      if (!templates || templates.length === 0) {
        return null;
      }

      // Pick template based on conditions
      const template = this.selectBestTemplate(templates, user, context);

      if (!template) return null;

      // Personalize the message
      const personalizedMessage = this.personalizeMessage(template.message_text, user, context);

      // Log hook sent
      await this.logHookSent(userId, template.id, hookType);

      return {
        template_id: template.id,
        message: personalizedMessage,
        hook_type: hookType
      };
    });
  }

  selectBestTemplate(templates, user, context) {
    // Simple selection logic - can be enhanced with AI later
    for (const template of templates) {
      if (this.templateMatches(template, user, context)) {
        return template;
      }
    }

    // Fallback to first template
    return templates[0];
  }

  templateMatches(template, user, context) {
    if (!template.trigger_condition) return true;

    const conditions = template.trigger_condition;

    // Check streak conditions
    if (conditions.has_active_streak && (!user.streak_count || user.streak_count === 0)) {
      return false;
    }

    if (conditions.streak_count) {
      if (conditions.streak_count.min && user.streak_count < conditions.streak_count.min) {
        return false;
      }
    }

    // Check activity conditions
    if (conditions.no_activity_today && context.answered_today) {
      return false;
    }

    return true;
  }

  personalizeMessage(messageText, user, context) {
    let personalized = messageText;

    // Replace placeholders
    personalized = personalized.replace('{username}', user.username || 'sharp student');
    personalized = personalized.replace('{display_name}', user.display_name || 'champion');
    personalized = personalized.replace('{streak_count}', user.streak_count || 0);

    // Add friend context if available
    if (context.friend_username) {
      personalized = personalized.replace('{friend_username}', context.friend_username);
    }

    return personalized;
  }

  async logHookSent(userId, templateId, hookType) {
    return executeQuery(async (supabase) => {
      await supabase.from('user_hook_history').insert({
        user_id: userId,
        hook_template_id: templateId,
        hook_type: hookType,
        sent_at: new Date().toISOString(),
        was_successful: true
      });
    });
  }

  async markHookResponse(userId, templateId) {
    return executeQuery(async (supabase) => {
      // Find recent hook and mark as responded
      await supabase
        .from('user_hook_history')
        .update({
          user_responded: true,
          response_time: 'NOW() - sent_at'
        })
        .eq('user_id', userId)
        .eq('hook_template_id', templateId)
        .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('sent_at', { ascending: false })
        .limit(1);
    });
  }

  async getUserHookStats(userId) {
    return executeQuery(async (supabase) => {
      const { data: stats } = await supabase
        .from('user_hook_history')
        .select('hook_type, user_responded, sent_at')
        .eq('user_id', userId)
        .gte('sent_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .order('sent_at', { ascending: false });

      return {
        total_hooks: stats?.length || 0,
        responded_count: stats?.filter((h) => h.user_responded).length || 0,
        response_rate:
          stats?.length > 0
            ? Math.round((stats.filter((h) => h.user_responded).length / stats.length) * 100)
            : 0
      };
    });
  }

  // Manual hook triggers (for testing and immediate use)
  async sendMorningHook(userId) {
    const context = { answered_today: false };
    return await this.getHookForUser(userId, 'morning_hook', context);
  }

  async sendStreakProtectionHook(userId) {
    const context = { streak_at_risk: true };
    return await this.getHookForUser(userId, 'evening_hook', context);
  }

  async sendComebackHook(userId) {
    const context = { days_inactive: 3 };
    return await this.getHookForUser(userId, 'comeback_hook', context);
  }

  async sendFOMOHook(userId) {
    const context = { peer_activity_high: true };
    return await this.getHookForUser(userId, 'fomo_hook', context);
  }
}

export const hookService = new HookService();
