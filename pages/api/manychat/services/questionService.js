import { executeQuery } from '../config/database.js';
import { CONSTANTS } from '../config/constants.js';

export class QuestionService {
  async getNextQuestion(userId, preferredSubject = null, difficulty = null) {
    try {
      return await executeQuery(async (supabase) => {
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('correct_answer_rate, preferred_subjects, grade')
          .eq('id', userId)
          .single();

        if (userError || !user) {
          console.error('User fetch error:', userError);
          throw new Error('User not found');
        }

        if (!difficulty) {
          difficulty = this.calculateDifficulty(user.correct_answer_rate);
        }

        const targetSubject =
          this.validateSubject(preferredSubject) ||
          this.selectRandomSubject(user.preferred_subjects);

        console.log(`🎯 Finding ${difficulty} question in ${targetSubject} for user ${userId}`);

        const { data: subject, error: subjectError } = await supabase
          .from('subjects')
          .select('id')
          .eq('name', targetSubject)
          .single();

        if (subjectError || !subject) {
          console.error(`Subject lookup failed for ${targetSubject}:`, subjectError);
          throw new Error(`Subject ${targetSubject} not found`);
        }

        const { data: question, error: questionError } = await supabase
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

        if (questionError) {
          console.error('Question fetch error:', questionError);
          throw questionError;
        }

        if (!question) {
          const fallbackDifficulties = this.getFallbackDifficulties(difficulty);
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
    } catch (error) {
      console.error(`❌ getNextQuestion error:`, error);
      return null;
    }
  }

  async getRandomQuestion(user, options = {}) {
    try {
      const { subject, difficulty, excludeRecent = true } = options;
      return await executeQuery(async (supabase) => {
        let query = supabase
          .from('mcqs')
          .select(
            `
            *,
            topics(name, display_name),
            subjects(name, display_name)
          `
          )
          .eq('is_active', true);

        if (subject) {
          const validatedSubject = this.validateSubject(subject);
          if (validatedSubject) {
            const { data: subjectData } = await supabase
              .from('subjects')
              .select('id')
              .eq('name', validatedSubject)
              .single();
            if (subjectData) {
              query = query.eq('subject_id', subjectData.id);
            }
          }
        }

        if (difficulty) {
          query = query.eq('difficulty', difficulty);
        }

        query = query.order('last_served_at', { ascending: true, nullsFirst: true }).limit(1);

        const { data, error } = await query.maybeSingle();

        if (error) {
          console.error('Random question fetch error:', error);
          return null;
        }

        return data;
      });
    } catch (error) {
      console.error(`❌ getRandomQuestion error:`, error);
      return null;
    }
  }

  async getQuestionByTopic(user, topicName, options = {}) {
    try {
      const { subject = 'math', difficulty, excludeRecent = true } = options;
      return await executeQuery(async (supabase) => {
        const { data: topic } = await supabase
          .from('topics')
          .select('id')
          .eq('name', topicName)
          .single();

        if (!topic) {
          console.log(`Topic ${topicName} not found, trying random question`);
          return await this.getRandomQuestion(user, { subject, difficulty });
        }

        let query = supabase
          .from('mcqs')
          .select(
            `
            *,
            topics(name, display_name),
            subjects(name, display_name)
          `
          )
          .eq('topic_id', topic.id)
          .eq('is_active', true);

        if (difficulty) {
          query = query.eq('difficulty', difficulty);
        }

        const { data, error } = await query
          .order('last_served_at', { ascending: true, nullsFirst: true })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Topic question fetch error:', error);
          return null;
        }

        return data;
      });
    } catch (error) {
      console.error(`❌ getQuestionByTopic error:`, error);
      return null;
    }
  }

  async serveQuestionToUser(userId, questionId) {
    try {
      return await executeQuery(async (supabase) => {
        const now = new Date().toISOString();

        const { error: userError } = await supabase
          .from('users')
          .update({
            current_question_id: questionId,
            last_active_at: now
          })
          .eq('id', userId);

        if (userError) {
          console.error('User update error:', userError);
          throw userError;
        }

        const { data: currentQuestion } = await supabase
          .from('mcqs')
          .select('times_served')
          .eq('id', questionId)
          .single();

        const { error: questionError } = await supabase
          .from('mcqs')
          .update({
            last_served_at: now,
            times_served: (currentQuestion?.times_served || 0) + 1
          })
          .eq('id', questionId);

        if (questionError) {
          console.error('Question update error:', questionError);
          throw questionError;
        }

        console.log(`✅ Question ${questionId} served to user ${userId}`);
      });
    } catch (error) {
      console.error(`❌ serveQuestionToUser error:`, error);
      throw error;
    }
  }

  formatQuestionText(question) {
    try {
      const choices = this.parseChoices(question.choices);
      const topicName = question.topics?.display_name || question.topics?.name || 'General';

      let text = `🎯 ${topicName} Question:\n\n${question.question_text}\n\n`;

      choices.forEach((choice, index) => {
        const letter = choice.choice || String.fromCharCode(65 + index);
        text += `${letter}) ${choice.text}\n`;
      });

      text += `\nJust send the letter (A, B, C or D). Sharp? 🔥`;

      return text;
    } catch (error) {
      console.error(`❌ formatQuestionText error:`, error);
      return `🚨 Question formatting error. Type "next" for another question! 🔄`;
    }
  }

  async recordUserResponse(userId, questionId, userAnswer, isCorrect, timeToAnswer = null) {
    try {
      return await executeQuery(async (supabase) => {
        const { data: question, error: questionError } = await supabase
          .from('mcqs')
          .select('correct_choice, topics(id), subjects(id)')
          .eq('id', questionId)
          .single();

        if (questionError || !question) {
          console.error('Question fetch error for response:', questionError);
          throw new Error('Question not found');
        }

        const sessionToken = this.generateSessionToken();

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

        if (responseError) {
          console.error('Response insert error:', responseError);
          throw responseError;
        }

        const { data: currentStats } = await supabase
          .from('mcqs')
          .select('times_correct, times_served')
          .eq('id', questionId)
          .single();

        const newTimesCorrect = (currentStats?.times_correct || 0) + (isCorrect ? 1 : 0);
        const timesServed = currentStats?.times_served || 1;
        const newAccuracyRate = timesServed > 0 ? newTimesCorrect / timesServed : 0;

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
    } catch (error) {
      console.error(`❌ recordUserResponse error:`, error);
      return null;
    }
  }

  async logWeakness(userId, questionId, wrongChoice, topicId, subjectId) {
    try {
      return await executeQuery(async (supabase) => {
        const choices = await this.getQuestionChoices(questionId);
        const choiceData = choices.find(
          (c) =>
            c.choice === wrongChoice ||
            (!c.choice && wrongChoice === String.fromCharCode(65 + choices.indexOf(c)))
        );

        const weaknessTag = choiceData?.weakness_tag || 'general_concept';

        const { data: existingWeakness } = await supabase
          .from('user_weaknesses')
          .select('id, occurrence_count')
          .eq('user_id', userId)
          .eq('mcq_id', questionId)
          .eq('weakness_tag', weaknessTag)
          .maybeSingle();

        if (existingWeakness) {
          const { error } = await supabase
            .from('user_weaknesses')
            .update({
              occurrence_count: existingWeakness.occurrence_count + 1,
              last_logged_at: new Date().toISOString()
            })
            .eq('id', existingWeakness.id);

          if (error) {
            console.error('Weakness update error:', error);
          }
        } else {
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

          if (error) {
            console.error('Weakness insert error:', error);
          }
        }

        console.log(`📝 Weakness logged: ${weaknessTag} for user ${userId}`);
        return weaknessTag;
      });
    } catch (error) {
      console.error(`❌ logWeakness error:`, error);
      return null;
    }
  }

  calculateDifficulty(accuracyRate) {
    const rate = accuracyRate || 0.5;
    if (rate >= 0.8) return CONSTANTS.DIFFICULTY.HARD;
    if (rate >= 0.5) return CONSTANTS.DIFFICULTY.MEDIUM;
    return CONSTANTS.DIFFICULTY.EASY;
  }

  selectRandomSubject(preferredSubjects) {
    if (!preferredSubjects || preferredSubjects.length === 0) {
      return 'math';
    }

    const validSubjects = preferredSubjects.filter((s) => this.validateSubject(s));
    if (validSubjects.length === 0) {
      return 'math';
    }

    const randomIndex = Math.floor(Math.random() * validSubjects.length);
    return validSubjects[randomIndex];
  }

  validateSubject(subject) {
    const validSubjects = [
      'math',
      'physics',
      'chemistry',
      'life_sciences',
      'english',
      'geography',
      'history'
    ];
    return validSubjects.includes(subject) ? subject : null;
  }

  getFallbackDifficulties(difficulty) {
    switch (difficulty) {
      case 'easy':
        return ['medium', 'hard'];
      case 'medium':
        return ['easy', 'hard'];
      case 'hard':
        return ['medium', 'easy'];
      default:
        return ['medium', 'easy'];
    }
  }

  parseChoices(choicesData) {
    if (!choicesData) return [];

    try {
      const parsed = typeof choicesData === 'string' ? JSON.parse(choicesData) : choicesData;
      if (Array.isArray(parsed)) {
        return parsed
          .slice(0, 4)
          .filter((choice) => choice && typeof choice === 'object' && choice.text);
      }
      return [];
    } catch (error) {
      console.error('Choice parsing error:', error);
      return [];
    }
  }

  async getQuestionChoices(questionId) {
    try {
      return await executeQuery(async (supabase) => {
        const { data: question, error } = await supabase
          .from('mcqs')
          .select('choices')
          .eq('id', questionId)
          .single();

        if (error) {
          console.error('Question choices fetch error:', error);
          return [];
        }

        return this.parseChoices(question?.choices);
      });
    } catch (error) {
      console.error(`❌ getQuestionChoices error:`, error);
      return [];
    }
  }

  generateSessionToken() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const questionService = new QuestionService();
