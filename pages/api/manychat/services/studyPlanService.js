/**
 * Study Plan Generation Service
 * Date: 2025-08-18 11:23:50 UTC
 * Author: sophoniagoat
 *
 * Generates personalized study plans based on exam date, topics, and user data
 */

import { executeQuery } from '../config/database.js';
import { formatDate } from '../utils/dateFormatter.js';

export class StudyPlanService {
  /**
   * Generate a personalized study plan based on user input
   *
   * @param {Object} user - User object
   * @param {Object} session - Exam prep session
   * @returns {Object} Generated study plan
   */
  async generateStudyPlan(user, session) {
    try {
      console.log(`📝 Generating study plan for user ${user.id}, session ${session.id}`);

      // Get exam date and calculate days until exam
      const examDate = session.exam_date ? new Date(session.exam_date) : null;
      const daysUntilExam = examDate ? this.calculateDaysUntilExam(examDate) : 7; // Default to 7 days if no date

      // Get focus topics and subject
      const focusTopics = session.focus_topics || [];
      const subject = session.focus_subject || 'math';

      // Get user grade
      const grade = user.grade || session.user_grade || '11'; // Default to grade 11

      // Generate study plan structure
      const studyPlan = await this.buildStudyPlanStructure(
        daysUntilExam,
        focusTopics,
        subject,
        grade
      );

      // Save study plan to database
      const savedPlan = await this.saveStudyPlan(session.id, studyPlan);

      console.log(
        `✅ Study plan generated successfully for user ${user.id}, ${studyPlan.days.length} days`
      );

      return savedPlan;
    } catch (error) {
      console.error('❌ Study plan generation error:', error);
      return this.generateFallbackPlan(session);
    }
  }

  /**
   * Calculate days between now and exam date
   */
  calculateDaysUntilExam(examDate) {
    const now = new Date();
    const diffTime = examDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays); // Minimum 1 day
  }

  /**
   * Build structured study plan based on available days
   */
  async buildStudyPlanStructure(daysUntilExam, focusTopics, subject, grade) {
    // Limit plan to 14 days maximum
    const planDays = Math.min(daysUntilExam, 14);

    // Get appropriate lessons for topics
    const lessons = await this.getLessonsForTopics(focusTopics, subject, grade, planDays);

    // Get appropriate practice questions
    const practiceQuestions = await this.getPracticeQuestionsForTopics(
      focusTopics,
      subject,
      grade,
      planDays * 3
    ); // 3 questions per day

    // Structure plan by day
    const studyPlan = {
      total_days: planDays,
      subject: subject,
      topics: focusTopics,
      days: []
    };

    // Distribution strategy:
    // - For short plans (1-3 days): Focus on key topics only
    // - For medium plans (4-7 days): Cover all topics with review
    // - For long plans (8+ days): Comprehensive coverage with spaced repetition

    let lessonIndex = 0;
    let questionIndex = 0;

    for (let day = 1; day <= planDays; day++) {
      const date = new Date();
      date.setDate(date.getDate() + (day - 1));

      // Determine day focus based on plan length
      const dayFocus = this.determineDayFocus(day, planDays, focusTopics);

      // Allocate lessons for this day (1-2 lessons per day)
      const dayLessons = [];
      const lessonsForDay = planDays <= 3 ? 2 : 1; // More lessons per day for short plans

      for (let i = 0; i < lessonsForDay && lessonIndex < lessons.length; i++) {
        // Prioritize lessons matching day focus
        const lessonIndex = lessons.findIndex(
          (l) => !l.assigned && (l.topic === dayFocus || dayFocus === 'review')
        );

        if (lessonIndex >= 0) {
          const lesson = lessons[lessonIndex];
          lesson.assigned = true;
          dayLessons.push(lesson);
        }
      }

      // Allocate practice questions (2-4 per day)
      const dayQuestions = [];
      const questionsForDay = Math.min(
        4,
        Math.max(2, Math.floor(practiceQuestions.length / planDays))
      );

      for (let i = 0; i < questionsForDay && questionIndex < practiceQuestions.length; i++) {
        dayQuestions.push(practiceQuestions[questionIndex++]);
      }

      // Create day plan
      studyPlan.days.push({
        day: day,
        date: date.toISOString(),
        focus: dayFocus,
        lessons: dayLessons,
        practice_questions: dayQuestions,
        completed: false,
        engagement_hooks: this.generateEngagementHooks(day, planDays, dayFocus)
      });
    }

    return studyPlan;
  }

  /**
   * Determine focus topic for a specific day
   */
  determineDayFocus(day, totalDays, topics) {
    if (topics.length === 0) return 'general';

    if (totalDays <= 3) {
      // Short plan: distribute topics evenly
      return topics[day % topics.length];
    } else if (totalDays <= 7) {
      // Medium plan: cover topics then review
      if (day <= topics.length) {
        return topics[day - 1];
      } else {
        return 'review';
      }
    } else {
      // Long plan: initial coverage, then spaced repetition
      if (day <= topics.length) {
        // First cycle: introduce topics
        return topics[day - 1];
      } else if (day <= topics.length * 2) {
        // Second cycle: reinforce topics
        return topics[(day - topics.length - 1) % topics.length];
      } else {
        // Final cycle: review and practice
        return 'review';
      }
    }
  }

  /**
   * Generate engagement hooks for a specific day
   */
  generateEngagementHooks(day, totalDays, focus) {
    // Calculate exam proximity
    let examProximity;
    if (day === totalDays) examProximity = 'last_day';
    else if (totalDays - day <= 2) examProximity = 'very_close';
    else if (totalDays - day <= 5) examProximity = 'approaching';
    else examProximity = 'distant';

    // Generate hooks based on day, proximity and focus
    return {
      morning_message: this.getMorningHook(day, totalDays, examProximity, focus),
      reminder_message: this.getReminderHook(day, totalDays, examProximity, focus),
      completion_message: this.getCompletionHook(day, totalDays, examProximity, focus)
    };
  }

  /**
   * Get morning engagement hook
   */
  getMorningHook(day, totalDays, examProximity, focus) {
    const morningHooks = {
      last_day: [
        `Today's the final day before your test! Let's make it count with focused ${focus} practice! 🎯`,
        `One day to go! Today we'll strengthen your ${focus} knowledge for tomorrow's test! 💪`,
        `Final prep day! We'll make sure your ${focus} skills are sharp for tomorrow! ⚡`
      ],
      very_close: [
        `Your test is almost here! Today's ${focus} practice will boost your confidence! 🚀`,
        `Just ${totalDays - day} days until your test! Today's ${focus} session is crucial! 🔥`,
        `${focus} mastery is coming together! ${totalDays - day} days left - you've got this! ✨`
      ],
      approaching: [
        `Good morning! Today's ${focus} practice keeps building toward test success! 📈`,
        `Day ${day} of your study plan focuses on ${focus}. Ready to continue building skills? 💡`,
        `We're making progress! Today's ${focus} practice brings you closer to mastery! 🌱`
      ],
      distant: [
        `Welcome to Day ${day} of your study plan! Today we focus on ${focus}. 📚`,
        `New day, new progress! Today's ${focus} lessons will build your foundation. 🧠`,
        `Day ${day}: Let's build your ${focus} skills step by step! 🔍`
      ]
    };

    const options = morningHooks[examProximity];
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Get reminder engagement hook
   */
  getReminderHook(day, totalDays, examProximity, focus) {
    const reminderHooks = {
      last_day: [
        `It's time for your final review session! Let's solidify your ${focus} knowledge before tomorrow! ⏰`,
        `Last study session before your test! Ready to strengthen your ${focus} skills? 🔔`,
        `Your scheduled ${focus} practice is ready - let's make this final session count! 🏁`
      ],
      very_close: [
        `Your ${focus} practice session is ready! With just ${totalDays - day} days left, every minute counts! ⏱️`,
        `Time for today's ${focus} study session! Your test is approaching fast! 🚀`,
        `Your scheduled study time has arrived! Today's ${focus} practice is crucial with the test so close! 💪`
      ],
      approaching: [
        `Your daily ${focus} study session is ready! Consistent practice leads to success! 🌟`,
        `It's time for your scheduled ${focus} practice! Keep building momentum! 🔄`,
        `Your ${focus} lesson and practice are waiting! Let's keep making progress! 📊`
      ],
      distant: [
        `Your study reminder: Today's ${focus} session is ready for you! 🎓`,
        `Time for today's ${focus} practice! Building skills step by step! 🧩`,
        `Your daily ${focus} study session is ready. Consistency is key to success! 🗝️`
      ]
    };

    const options = reminderHooks[examProximity];
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Get completion engagement hook
   */
  getCompletionHook(day, totalDays, examProximity, focus) {
    const completionHooks = {
      last_day: [
        `Excellent work completing your final study session! You're ready for tomorrow's test! 🏆`,
        `You've finished your study plan! Rest well tonight - you're prepared for tomorrow! 🌙`,
        `Final session complete! You've put in the work and you're ready to succeed tomorrow! 🎉`
      ],
      very_close: [
        `Great job today! Just ${totalDays - day} more days of focused practice before your test! 👏`,
        `Today's ${focus} practice complete! You're getting stronger with every session! 💯`,
        `Session complete! Your test is approaching and you're making excellent progress! 🚀`
      ],
      approaching: [
        `Day ${day} complete! Your consistent effort will pay off on test day! 🌟`,
        `You've finished today's ${focus} practice! Each day brings you closer to mastery! 📈`,
        `Well done completing today's session! Your ${focus} skills are visibly improving! 🔍`
      ],
      distant: [
        `Day ${day} complete! You're building a strong foundation for test success! 🏗️`,
        `Great work today! Consistent practice like this is how mastery is built! 🧠`,
        `Today's ${focus} session complete! Your dedication will lead to success! ✨`
      ]
    };

    const options = completionHooks[examProximity];
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Get lessons for specified topics
   */
  async getLessonsForTopics(topics, subject, grade, count) {
    return executeQuery(async (supabase) => {
      let query = supabase
        .from('lessons')
        .select('id, title, content, topic, subject, grade_level, effectiveness_score')
        .eq('subject', subject)
        .eq('is_active', true)
        .order('effectiveness_score', { ascending: false });

      // Filter by grade (include current grade and one below)
      const gradeLevel = parseInt(grade);
      if (!isNaN(gradeLevel)) {
        query = query.in('grade_level', [gradeLevel, gradeLevel - 1]);
      }

      // Filter by topics if available
      if (topics && topics.length > 0) {
        query = query.in('topic', topics);
      }

      // Limit and fetch
      const { data, error } = await query.limit(count * 2); // Get more than needed to allow for filtering

      if (error) {
        console.error('❌ Lessons fetch error:', error);
        return [];
      }

      // Map to add assigned property
      return (data || []).slice(0, count).map((lesson) => ({
        ...lesson,
        assigned: false
      }));
    });
  }

  /**
   * Get practice questions for specified topics
   */
  async getPracticeQuestionsForTopics(topics, subject, grade, count) {
    return executeQuery(async (supabase) => {
      let query = supabase
        .from('practice_questions')
        .select('id, question_text, solution_steps, topic, subject, difficulty, grade_level')
        .eq('subject', subject)
        .eq('is_active', true);

      // Filter by grade
      const gradeLevel = parseInt(grade);
      if (!isNaN(gradeLevel)) {
        query = query.in('grade_level', [gradeLevel, gradeLevel - 1]);
      }

      // Filter by topics if available
      if (topics && topics.length > 0) {
        query = query.in('topic', topics);
      }

      // Ensure good distribution of difficulty
      const { data: easyQuestions } = await query
        .eq('difficulty', 'easy')
        .limit(Math.ceil(count * 0.4));

      const { data: mediumQuestions } = await query
        .eq('difficulty', 'medium')
        .limit(Math.ceil(count * 0.4));

      const { data: hardQuestions } = await query
        .eq('difficulty', 'hard')
        .limit(Math.ceil(count * 0.2));

      // Combine and shuffle
      const allQuestions = [
        ...(easyQuestions || []),
        ...(mediumQuestions || []),
        ...(hardQuestions || [])
      ];

      // Simple shuffle
      for (let i = allQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
      }

      return allQuestions.slice(0, count);
    });
  }

  /**
   * Save study plan to database
   */
  async saveStudyPlan(sessionId, studyPlan) {
    return executeQuery(async (supabase) => {
      // Check if plan already exists
      const { data: existingPlan } = await supabase
        .from('study_plans')
        .select('id')
        .eq('session_id', sessionId)
        .maybeSingle();

      const now = new Date().toISOString();

      if (existingPlan) {
        // Update existing plan
        const { data, error } = await supabase
          .from('study_plans')
          .update({
            plan_data: studyPlan,
            updated_at: now
          })
          .eq('id', existingPlan.id)
          .select()
          .single();

        if (error) {
          console.error('❌ Study plan update error:', error);
          throw error;
        }

        return data;
      } else {
        // Create new plan
        const { data, error } = await supabase
          .from('study_plans')
          .insert({
            session_id: sessionId,
            plan_data: studyPlan,
            created_at: now,
            updated_at: now,
            is_active: true
          })
          .select()
          .single();

        if (error) {
          console.error('❌ Study plan creation error:', error);
          throw error;
        }

        return data;
      }
    });
  }

  /**
   * Generate fallback plan when normal generation fails
   */
  async generateFallbackPlan(session) {
    const focusTopic = (session.focus_topics && session.focus_topics[0]) || 'general';
    const subject = session.focus_subject || 'math';

    // Simple 3-day plan
    const fallbackPlan = {
      total_days: 3,
      subject: subject,
      topics: [focusTopic],
      days: []
    };

    // Generate simple days
    for (let day = 1; day <= 3; day++) {
      const date = new Date();
      date.setDate(date.getDate() + (day - 1));

      fallbackPlan.days.push({
        day: day,
        date: date.toISOString(),
        focus: focusTopic,
        lessons: [],
        practice_questions: [],
        completed: false,
        engagement_hooks: {
          morning_message: `Day ${day} of your ${focusTopic} study plan. Let's keep building skills! 📚`,
          reminder_message: `Time for your daily ${focusTopic} practice! Consistency leads to success! ⏰`,
          completion_message: `Great work completing day ${day}! You're making progress! 🎯`
        }
      });
    }

    try {
      return await this.saveStudyPlan(session.id, fallbackPlan);
    } catch (error) {
      console.error('❌ Fallback plan save error:', error);
      return { plan_data: fallbackPlan };
    }
  }

  /**
   * Visualize study plan for user
   */
  visualizeStudyPlan(plan, currentDay = 1) {
    const planData = plan.plan_data;
    if (!planData || !planData.days || planData.days.length === 0) {
      return 'Study plan data not available. Please contact support.';
    }

    // Get total days and topics
    const totalDays = planData.total_days;
    const topics = planData.topics.length > 0 ? planData.topics.join(', ') : 'general concepts';

    // Get current day data
    const today = planData.days.find((d) => d.day === currentDay) || planData.days[0];
    const daysLeft = totalDays - currentDay + 1;

    // Create visualization
    let visualization = `📅 **YOUR ${planData.subject.toUpperCase()} STUDY PLAN**\n\n`;

    // Overall plan summary
    visualization += `${daysLeft} days remaining until your test\n`;
    visualization += `Focus: ${topics}\n\n`;

    // Progress bar
    const progressPercentage = ((currentDay - 1) / totalDays) * 100;
    const progressBar = this.generateProgressBar(progressPercentage);
    visualization += `Progress: ${progressBar} ${Math.round(progressPercentage)}%\n\n`;

    // Today's focus
    visualization += `**TODAY (DAY ${currentDay}):**\n`;
    visualization += `Focus: ${today.focus}\n`;
    visualization += `Lessons: ${today.lessons.length}\n`;
    visualization += `Practice questions: ${today.practice_questions.length}\n\n`;

    // Lesson preview
    if (today.lessons.length > 0) {
      visualization += `**Today's Lessons:**\n`;
      today.lessons.forEach((lesson, i) => {
        visualization += `${i + 1}. ${lesson.title}\n`;
      });
      visualization += `\n`;
    }

    // Call to action
    visualization += `Ready to start today's session? Reply "start" to begin!`;

    return visualization;
  }

  /**
   * Generate ASCII progress bar
   */
  generateProgressBar(percentage, length = 10) {
    const filledLength = Math.round((percentage / 100) * length);
    const emptyLength = length - filledLength;

    return '█'.repeat(filledLength) + '▒'.repeat(emptyLength);
  }
}

export const studyPlanService = new StudyPlanService();
