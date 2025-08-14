import { executeQuery } from '../config/database.js';
import { CONSTANTS } from '../config/constants.js';

export class QuestionService {
  async getNextQuestion(userId, preferredSubject = null, difficulty = null) {
    return executeQuery(async (supabase) => {
      // Get user profile for difficulty calculation
      const { data: user } = await supabase
        .from('users')
        .select('correct_answer_rate, preferred_subjects, grade')
        .eq('id', userId)
        .single();

      if (!user) throw new Error('User not found');

      // Determine difficulty if not specified
      if (!difficulty) {
        difficulty = this.calculateDifficulty(user.correct_answer_rate);
      }

      // Determine subject
      const targetSubject = preferredSubject || this.selectRandomSubject(user.preferred_subjects);

      console.log(`🎯 Finding ${difficulty} question in ${targetSubject} for user ${userId}`);

      // Get subject ID
      const { data: subject } = await supabase
        .from('subjects')
        .select('id')
        .eq('name', targetSubject)
        .single();

      if (!subject) {
        throw new Error(`Subject ${targetSubject} not found`);
      }

      // Find next question (least recently served)
      const { data: question, error } = await supabase
        .from('mcqs')
        .select(
          `
          *,
          topics(name, display_name),
          subjects(name, display_name)
        `
        )
        .eq('subject_id', subject.id)
        .eq('difficulty', difficulty)
        .eq('is_active', true)
        .order('last_served_at', { ascending: true, nullsFirst: true })
        .order('times_served', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!question) {
        // Try other difficulties if none available
        const fallbackDifficulties =
          difficulty === 'easy'
            ? ['medium', 'hard']
            : difficulty === 'medium'
              ? ['easy', 'hard']
              : ['medium', 'easy'];

        for (const fallbackDiff of fallbackDifficulties) {
          const { data: fallbackQuestion } = await supabase
            .from('mcqs')
            .select(
              `
              *,
              topics(name, display_name),
              subjects(name, display_name)
            `
            )
            .eq('subject_id', subject.id)
            .eq('difficulty', fallbackDiff)
            .eq('is_active', true)
            .order('last_served_at', { ascending: true, nullsFirst: true })
            .limit(1)
            .maybeSingle();

          if (fallbackQuestion) {
            console.log(`📝 Using fallback difficulty: ${fallbackDiff}`);
            return fallbackQuestion;
          }
        }

        throw new Error(`No questions available for ${targetSubject}`);
      }

      return question;
    });
  }

  async serveQuestionToUser(userId, questionId) {
    return executeQuery(async (supabase) => {
      const now = new Date().toISOString();

      // Update user's current question
      const { error: userError } = await supabase
        .from('users')
        .update({
          current_question_id: questionId,
          last_active_at: now
        })
        .eq('id', userId);

      if (userError) throw userError;

      // Get current times_served count first
      const { data: currentQuestion } = await supabase
        .from('mcqs')
        .select('times_served')
        .eq('id', questionId)
        .single();

      // Update question served stats
      const { error: questionError } = await supabase
        .from('mcqs')
        .update({
          last_served_at: now,
          times_served: (currentQuestion?.times_served || 0) + 1
        })
        .eq('id', questionId);

      if (questionError) throw questionError;

      console.log(`✅ Question ${questionId} served to user ${userId}`);
    });
  }

  formatQuestionText(question) {
    const choices = this.parseChoices(question.choices);
    const topicName = question.topics?.display_name || question.topics?.name || 'General';

    let text = `🎯 ${topicName} Question:\n\n${question.question_text}\n\n`;

    choices.forEach((choice, index) => {
      const letter = choice.choice || String.fromCharCode(65 + index);
      text += `${letter}) ${choice.text}\n`;
    });

    text += `\nJust send the letter (A, B, C or D). Sharp? 🔥`;

    return text;
  }

  async recordUserResponse(userId, questionId, userAnswer, isCorrect, timeToAnswer = null) {
    return executeQuery(async (supabase) => {
      // Get question details for context
      const { data: question } = await supabase
        .from('mcqs')
        .select('correct_choice, topics(id), subjects(id)')
        .eq('id', questionId)
        .single();

      if (!question) throw new Error('Question not found');

      // Generate session token if needed
      const sessionToken = this.generateSessionToken();

      // Record the response
      const { error: responseError } = await supabase.from('user_responses').insert({
        user_id: userId,
        mcq_id: questionId,
        user_answer: userAnswer,
        correct_answer: question.correct_choice,
        is_correct: isCorrect,
        time_taken: timeToAnswer,
        session_id: sessionToken,
        answered_at: new Date().toISOString()
      });

      if (responseError) throw responseError;

      // Get current question stats
      const { data: currentStats } = await supabase
        .from('mcqs')
        .select('times_correct, times_served')
        .eq('id', questionId)
        .single();

      // Calculate new stats
      const newTimesCorrect = (currentStats?.times_correct || 0) + (isCorrect ? 1 : 0);
      const timesServed = currentStats?.times_served || 1;
      const newAccuracyRate = timesServed > 0 ? newTimesCorrect / timesServed : 0;

      // Update question stats
      await supabase
        .from('mcqs')
        .update({
          times_correct: newTimesCorrect,
          accuracy_rate: newAccuracyRate
        })
        .eq('id', questionId);

      console.log(
        `📊 Response recorded: User ${userId}, Question ${questionId}, Correct: ${isCorrect}`
      );

      return {
        sessionToken,
        topicId: question.topics?.id,
        subjectId: question.subjects?.id
      };
    });
  }

  async logWeakness(userId, questionId, wrongChoice, topicId, subjectId) {
    return executeQuery(async (supabase) => {
      const choices = await this.getQuestionChoices(questionId);
      const choiceData = choices.find(
        (c) =>
          c.choice === wrongChoice ||
          (!c.choice && wrongChoice === String.fromCharCode(65 + choices.indexOf(c)))
      );

      const weaknessTag = choiceData?.weakness_tag || 'general_concept';

      // Check if weakness already exists
      const { data: existingWeakness } = await supabase
        .from('user_weaknesses')
        .select('id, occurrence_count')
        .eq('user_id', userId)
        .eq('mcq_id', questionId)
        .eq('weakness_tag', weaknessTag)
        .maybeSingle();

      if (existingWeakness) {
        // Update existing weakness
        const { error } = await supabase
          .from('user_weaknesses')
          .update({
            occurrence_count: existingWeakness.occurrence_count + 1,
            last_logged_at: new Date().toISOString()
          })
          .eq('id', existingWeakness.id);

        if (error) throw error;
      } else {
        // Insert new weakness
        const { error } = await supabase.from('user_weaknesses').insert({
          user_id: userId,
          mcq_id: questionId,
          weakness_tag: weaknessTag,
          topic_id: topicId,
          subject_id: subjectId,
          occurrence_count: 1,
          first_logged_at: new Date().toISOString(),
          last_logged_at: new Date().toISOString()
        });

        if (error) throw error;
      }

      console.log(`📝 Weakness logged: ${weaknessTag} for user ${userId}`);
      return weaknessTag;
    });
  }

  calculateDifficulty(accuracyRate) {
    if (accuracyRate >= 0.8) return CONSTANTS.DIFFICULTY.HARD;
    if (accuracyRate >= 0.5) return CONSTANTS.DIFFICULTY.MEDIUM;
    return CONSTANTS.DIFFICULTY.EASY;
  }

  selectRandomSubject(preferredSubjects) {
    if (!preferredSubjects || preferredSubjects.length === 0) {
      return 'math'; // Default fallback
    }

    const randomIndex = Math.floor(Math.random() * preferredSubjects.length);
    return preferredSubjects[randomIndex];
  }

  parseChoices(choicesData) {
    if (!choicesData) return [];

    try {
      const parsed = typeof choicesData === 'string' ? JSON.parse(choicesData) : choicesData;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async getQuestionChoices(questionId) {
    return executeQuery(async (supabase) => {
      const { data: question } = await supabase
        .from('mcqs')
        .select('choices')
        .eq('id', questionId)
        .single();

      return this.parseChoices(question?.choices);
    });
  }

  generateSessionToken() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const questionService = new QuestionService();
