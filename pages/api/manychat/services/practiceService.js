/**
 * Practice Question Service
 * Date: 2025-08-18 11:59:33 UTC
 * Author: sophoniagoat
 *
 * Manages practice question delivery, generation, and understanding assessment
 */

import { executeQuery } from '../config/database.js';
import { getOpenAIClient, OPENAI_CONFIG } from '../config/openai.js';

export class PracticeService {
  constructor() {
    this.client = null;
  }

  async getClient() {
    if (!this.client) {
      this.client = getOpenAIClient();
    }
    return this.client;
  }

  /**
   * Get practice question by ID
   *
   * @param {string} questionId - Question ID
   * @returns {Object} Question data
   */
  async getQuestionById(questionId) {
    return executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('practice_questions')
        .select('*')
        .eq('id', questionId)
        .single();

      if (error) {
        console.error('❌ Question fetch error:', error);
        return null;
      }

      return data;
    });
  }

  /**
   * Get practice questions by topic
   *
   * @param {string} topic - Topic name
   * @param {Object} options - Query options
   * @returns {Array} Questions matching criteria
   */
  async getQuestionsByTopic(topic, options = {}) {
    const { grade = null, difficulty = null, limit = 5, excludeIds = [] } = options;

    return executeQuery(async (supabase) => {
      let query = supabase
        .from('practice_questions')
        .select('*')
        .eq('topic', topic)
        .eq('is_active', true);

      // Apply grade filter if provided
      if (grade) {
        query = query.eq('grade_level', grade);
      }

      // Apply difficulty filter if provided
      if (difficulty) {
        query = query.eq('difficulty', difficulty);
      }

      // Exclude specific questions if needed
      if (excludeIds.length > 0) {
        query = query.not('id', 'in', `(${excludeIds.join(',')})`);
      }

      // Order by last used (prioritize least recently used)
      query = query.order('last_used_at', { ascending: true, nullsFirst: true });

      const { data, error } = await query.limit(limit);

      if (error) {
        console.error('❌ Questions by topic fetch error:', error);
        return [];
      }

      return data || [];
    });
  }

  /**
   * Generate a practice question using AI
   *
   * @param {Object} parameters - Generation parameters
   * @returns {Object} Generated question
   */
  async generateQuestion(parameters) {
    try {
      console.log(`🧠 Generating practice question: ${parameters.topic}, ${parameters.difficulty}`);

      const {
        topic,
        subtopic = null,
        difficulty = 'medium',
        grade = 11,
        previousQuestions = [],
        conceptsToReinforce = [],
        userStrengths = [],
        userWeaknesses = []
      } = parameters;

      // Build the prompt for question generation
      const prompt = this.buildQuestionGenerationPrompt(
        topic,
        subtopic,
        difficulty,
        grade,
        previousQuestions,
        conceptsToReinforce,
        userStrengths,
        userWeaknesses
      );

      // Call GPT for question generation
      const client = await this.getClient();
      const completion = await client.chat.completions.create({
        model: OPENAI_CONFIG.MODEL,
        messages: [
          { role: 'system', content: prompt },
          {
            role: 'user',
            content: `Generate a ${difficulty} question about ${topic} ${subtopic ? `(${subtopic})` : ''} for grade ${grade}.`
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });

      // Parse response
      const response = JSON.parse(completion.choices[0].message.content);

      // Save the generated question to the database
      const savedQuestion = await this.saveGeneratedQuestion(response, parameters);

      return savedQuestion;
    } catch (error) {
      console.error('❌ Question generation error:', error);

      // Return a fallback question
      return this.getFallbackQuestion(parameters.topic, parameters.grade);
    }
  }

  /**
   * Build prompt for question generation
   */
  buildQuestionGenerationPrompt(
    topic,
    subtopic,
    difficulty,
    grade,
    previousQuestions,
    conceptsToReinforce,
    userStrengths,
    userWeaknesses
  ) {
    return `You are an expert mathematics teacher specializing in creating high-quality practice questions.

YOUR TASK: Generate an open-ended, non-multiple-choice practice question that encourages critical thinking and demonstrates understanding.

TOPIC: ${topic}${subtopic ? ` (${subtopic})` : ''}
DIFFICULTY: ${difficulty}
GRADE LEVEL: ${grade}

${userWeaknesses.length > 0 ? `AREAS TO FOCUS ON: ${userWeaknesses.join(', ')}` : ''}
${conceptsToReinforce.length > 0 ? `CONCEPTS TO REINFORCE: ${conceptsToReinforce.join(', ')}` : ''}

QUESTION REQUIREMENTS:
- Create a contextually rich, open-ended question that requires explanation
- The question should test conceptual understanding, not just calculation
- Include a step-by-step solution with explanations
- Identify key conceptual checkpoints a student should demonstrate
- Include hints that can be provided if the student struggles

RESPONSE FORMAT:
Provide your response in the following JSON format:
{
  "question_text": "The complete question text",
  "solution_steps": "Step-by-step solution with explanations",
  "key_concepts": ["concept1", "concept2", "..."],
  "hints": ["hint1", "hint2", "..."],
  "understanding_checkpoints": ["checkpoint1", "checkpoint2", "..."],
  "difficulty": "${difficulty}",
  "topic": "${topic}",
  "subtopic": "${subtopic || ''}",
  "estimated_time_minutes": number
}

IMPORTANT NOTES:
- The question should be appropriate for WhatsApp delivery (text only, no images)
- For grade ${grade} students
- Questions involving calculations should have reasonable numbers
- Focus on conceptual understanding over procedural knowledge
- The solution should explain WHY each step works, not just WHAT to do`;
  }

  /**
   * Save generated question to database
   */
  async saveGeneratedQuestion(questionData, parameters) {
    return executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('practice_questions')
        .insert({
          question_text: questionData.question_text,
          solution_steps: questionData.solution_steps,
          topic: parameters.topic,
          subtopic: parameters.subtopic || null,
          subject: 'math',
          difficulty: parameters.difficulty,
          grade_level: parameters.grade,
          key_concepts: questionData.key_concepts || [],
          hints: questionData.hints || [],
          understanding_checkpoints: questionData.understanding_checkpoints || [],
          estimated_time_minutes: questionData.estimated_time_minutes || 5,
          is_ai_generated: true,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Question save error:', error);
        throw error;
      }

      return data;
    });
  }

  /**
   * Get a fallback question when generation fails
   */
  async getFallbackQuestion(topic, grade) {
    // Try to get an existing question on the topic
    const existingQuestions = await this.getQuestionsByTopic(topic, { grade, limit: 1 });

    if (existingQuestions.length > 0) {
      return existingQuestions[0];
    }

    // Create a generic fallback question
    return {
      id: 'fallback',
      question_text: `Think about the key concepts in ${topic}. Explain one important idea and how it applies to solving problems.`,
      solution_steps: `The key concepts in ${topic} include understanding the fundamental principles, applying the correct formulas, and checking your work. A thorough explanation should discuss the core ideas and how they connect to real-world applications.`,
      topic,
      difficulty: 'medium',
      grade_level: grade,
      key_concepts: [topic],
      hints: [
        'Start by defining the main concept',
        'Consider how this concept applies to examples'
      ],
      is_ai_generated: false,
      is_active: true
    };
  }

  /**
   * Format practice question for WhatsApp delivery
   *
   * @param {Object} question - Question object
   * @param {Object} options - Formatting options
   * @returns {string} Formatted question text
   */
  formatQuestion(question, options = {}) {
    const {
      showHeader = true,
      showHints = false,
      hintNumber = 0,
      dayNumber = null,
      questionNumber = null,
      totalQuestions = null
    } = options;

    let formattedQuestion = '';

    // Add header if requested
    if (showHeader) {
      formattedQuestion += `🧮 **PRACTICE QUESTION**\n\n`;

      if (dayNumber !== null && questionNumber !== null && totalQuestions !== null) {
        formattedQuestion += `Day ${dayNumber} - Question ${questionNumber}/${totalQuestions}\n\n`;
      }

      if (question.topic) {
        formattedQuestion += `Topic: ${question.topic.toUpperCase()}\n`;
      }

      if (question.difficulty) {
        const difficultyEmoji =
          question.difficulty === 'easy'
            ? '⭐'
            : question.difficulty === 'medium'
              ? '⭐⭐'
              : '⭐⭐⭐';

        formattedQuestion += `Difficulty: ${difficultyEmoji}\n\n`;
      } else {
        formattedQuestion += `\n`;
      }
    }

    // Add main question
    formattedQuestion += `${question.question_text}\n\n`;

    // Add hints if requested
    if (showHints && question.hints && question.hints.length > 0) {
      if (hintNumber === 0) {
        formattedQuestion += `💡 *Hint available*: Type "hint" if you need help.\n\n`;
      } else if (hintNumber <= question.hints.length) {
        formattedQuestion += `💡 *Hint ${hintNumber}*: ${question.hints[hintNumber - 1]}\n\n`;

        if (hintNumber < question.hints.length) {
          formattedQuestion += `Type "hint" for another hint.\n\n`;
        }
      }
    }

    // Add footer
    formattedQuestion += `When you're ready to see the solution, type "solution".\n\n`;
    formattedQuestion += `If you'd like to skip this question, type "skip".`;

    return formattedQuestion;
  }

  /**
   * Format solution for WhatsApp delivery
   *
   * @param {Object} question - Question object
   * @param {Object} options - Formatting options
   * @returns {string} Formatted solution text
   */
  formatSolution(question, options = {}) {
    const { dayNumber = null, questionNumber = null, totalQuestions = null } = options;

    let formattedSolution = '';

    // Add header
    formattedSolution += `✅ **SOLUTION**\n\n`;

    if (dayNumber !== null && questionNumber !== null && totalQuestions !== null) {
      formattedSolution += `Day ${dayNumber} - Question ${questionNumber}/${totalQuestions}\n\n`;
    }

    // Add solution steps
    formattedSolution += `${question.solution_steps}\n\n`;

    // Add key concepts if available
    if (question.key_concepts && question.key_concepts.length > 0) {
      formattedSolution += `🔑 **Key Concepts**:\n`;
      question.key_concepts.forEach((concept) => {
        formattedSolution += `• ${concept}\n`;
      });
      formattedSolution += `\n`;
    }

    // Add understanding assessment
    formattedSolution += `📊 **Rate your understanding**:\n\n`;
    formattedSolution += `On a scale of 1-5, how well did you understand this solution?\n`;
    formattedSolution += `1️⃣ Not at all\n`;
    formattedSolution += `2️⃣ Slightly\n`;
    formattedSolution += `3️⃣ Moderately\n`;
    formattedSolution += `4️⃣ Very well\n`;
    formattedSolution += `5️⃣ Completely\n\n`;
    formattedSolution += `Reply with a number from 1-5.`;

    return formattedSolution;
  }

  /**
   * Record practice question attempt
   *
   * @param {string} questionId - Question ID
   * @param {string} userId - User ID
   * @param {Object} context - Attempt context
   * @returns {string} Attempt ID
   */
  async recordQuestionAttempt(questionId, userId, context = {}) {
    return executeQuery(async (supabase) => {
      // Create attempt record
      const { data, error } = await supabase
        .from('practice_attempts')
        .insert({
          question_id: questionId,
          user_id: userId,
          session_id: context.sessionId,
          study_plan_id: context.studyPlanId,
          day_number: context.dayNumber,
          hints_used: context.hintsUsed || 0,
          status: 'started',
          started_at: new Date().toISOString(),
          context_data: context
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Question attempt recording error:', error);
        throw error;
      }

      // Update question last_used_at timestamp
      await supabase
        .from('practice_questions')
        .update({
          last_used_at: new Date().toISOString()
        })
        .eq('id', questionId);

      return data.id;
    });
  }

  /**
   * Update practice question attempt with result
   *
   * @param {string} attemptId - Attempt ID
   * @param {number} understandingRating - Rating 1-5
   * @param {Object} additionalData - Any additional data
   * @returns {boolean} Success status
   */
  async updateQuestionAttempt(attemptId, understandingRating, additionalData = {}) {
    try {
      console.log(`📝 Updating question attempt ${attemptId}, rating: ${understandingRating}`);

      // Validate rating
      const rating = parseInt(understandingRating);
      if (isNaN(rating) || rating < 1 || rating > 5) {
        console.error('❌ Invalid understanding rating:', understandingRating);
        return false;
      }

      await executeQuery(async (supabase) => {
        // Update attempt record
        const { error } = await supabase
          .from('practice_attempts')
          .update({
            status: 'completed',
            understanding_rating: rating,
            completed_at: new Date().toISOString(),
            ...additionalData
          })
          .eq('id', attemptId);

        if (error) {
          console.error('❌ Question attempt update error:', error);
          throw error;
        }
      });

      return true;
    } catch (error) {
      console.error('❌ Attempt update error:', error);
      return false;
    }
  }

  /**
   * Assess user's understanding from their responses
   *
   * @param {string} userId - User ID
   * @param {string} questionId - Question ID
   * @param {string} response - User's response text
   * @returns {Object} Assessment results
   */
  async assessUnderstanding(userId, questionId, response) {
    try {
      // Get the question and its key concepts
      const question = await this.getQuestionById(questionId);
      if (!question) {
        throw new Error(`Question not found: ${questionId}`);
      }

      // Use AI to assess understanding
      const assessment = await this.getUnderstandingAssessment(question, response);

      // Record assessment results
      await this.recordUnderstandingAssessment(userId, questionId, assessment);

      return assessment;
    } catch (error) {
      console.error('❌ Understanding assessment error:', error);
      return {
        understanding_level: 3, // Default to middle level
        key_concepts_demonstrated: [],
        misconceptions: [],
        feedback:
          "I couldn't analyze your response in detail, but I appreciate your effort. Let's continue with more practice to build your skills."
      };
    }
  }

  /**
   * Use AI to assess understanding from response
   */
  async getUnderstandingAssessment(question, response) {
    const client = await this.getClient();
    const prompt = this.buildUnderstandingAssessmentPrompt(question);

    const completion = await client.chat.completions.create({
      model: OPENAI_CONFIG.MODEL,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: response }
      ],
      max_tokens: 500,
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    // Parse response
    return JSON.parse(completion.choices[0].message.content);
  }

  /**
   * Build prompt for understanding assessment
   */
  buildUnderstandingAssessmentPrompt(question) {
    return `You are an expert mathematics tutor who assesses student understanding based on their responses to practice questions.

QUESTION: ${question.question_text}

CORRECT SOLUTION: ${question.solution_steps}

KEY CONCEPTS: ${question.key_concepts ? question.key_concepts.join(', ') : 'Not provided'}

UNDERSTANDING CHECKPOINTS: ${question.understanding_checkpoints ? question.understanding_checkpoints.join(', ') : 'Not provided'}

YOUR TASK: Analyze the student's response to determine their level of understanding.

ASSESSMENT CRITERIA:
1. Does the response demonstrate understanding of the key concepts?
2. Are there any misconceptions evident in the response?
3. Does the approach make logical sense, even if the execution has errors?
4. Is there evidence of problem-solving skills and critical thinking?

RESPONSE FORMAT:
Respond with a JSON object containing:
{
  "understanding_level": number from 1-5 (1=poor, 5=excellent),
  "key_concepts_demonstrated": ["concept1", "concept2", ...],
  "misconceptions": ["misconception1", "misconception2", ...],
  "feedback": "Constructive, encouraging feedback for the student"
}

IMPORTANT NOTES:
- Focus on conceptual understanding over computational accuracy
- Look for evidence of logical reasoning rather than just correct answers
- Be generous in your assessment - students may understand more than they articulate
- Provide specific, actionable feedback
- Keep feedback encouraging and growth-oriented`;
  }

  /**
   * Record understanding assessment results
   */
  async recordUnderstandingAssessment(userId, questionId, assessment) {
    return executeQuery(async (supabase) => {
      // Find the most recent attempt for this question by this user
      const { data: attempts } = await supabase
        .from('practice_attempts')
        .select('id')
        .eq('question_id', questionId)
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(1);

      if (attempts && attempts.length > 0) {
        // Update the attempt with assessment data
        await supabase
          .from('practice_attempts')
          .update({
            understanding_level: assessment.understanding_level,
            concepts_demonstrated: assessment.key_concepts_demonstrated,
            misconceptions: assessment.misconceptions,
            tutor_feedback: assessment.feedback,
            updated_at: new Date().toISOString()
          })
          .eq('id', attempts[0].id);
      }
    });
  }

  /**
   * Get next appropriate question based on user's performance
   *
   * @param {string} userId - User ID
   * @param {string} currentTopic - Current topic
   * @param {string} currentDifficulty - Current difficulty
   * @param {number} currentUnderstanding - Current understanding level (1-5)
   * @returns {Object} Next question
   */
  async getNextAppropriateQuestion(userId, currentTopic, currentDifficulty, currentUnderstanding) {
    try {
      // Get user's recent question attempts
      const recentAttempts = await this.getUserRecentAttempts(userId, 10);
      const recentQuestionIds = recentAttempts.map((a) => a.question_id);

      // Calculate next difficulty based on current understanding
      const nextDifficulty = this.calculateNextDifficulty(currentDifficulty, currentUnderstanding);

      // Get user's strengths and weaknesses
      const { strengths, weaknesses } = await this.analyzeUserPerformance(userId, currentTopic);

      // Decide whether to reinforce current topic or introduce a related one
      let targetTopic = currentTopic;
      let targetSubtopic = null;

      // If understanding is high, consider introducing a related topic
      if (currentUnderstanding >= 4 && Math.random() > 0.7) {
        const relatedTopics = await this.getRelatedTopics(currentTopic);
        if (relatedTopics.length > 0) {
          // 30% chance to switch to a related topic when understanding is good
          targetTopic = relatedTopics[Math.floor(Math.random() * relatedTopics.length)];
        }
      }
      // If understanding is low, focus on identified weaknesses
      else if (currentUnderstanding <= 2 && weaknesses.length > 0) {
        targetSubtopic = weaknesses[Math.floor(Math.random() * weaknesses.length)];
      }

      // Try to get an existing question first
      const existingQuestions = await this.getQuestionsByTopic(targetTopic, {
        difficulty: nextDifficulty,
        excludeIds: recentQuestionIds,
        limit: 3
      });

      if (existingQuestions.length > 0) {
        // Randomly select one of the top matches to add variety
        return existingQuestions[Math.floor(Math.random() * existingQuestions.length)];
      }

      // Generate a new question if none exists
      return await this.generateQuestion({
        topic: targetTopic,
        subtopic: targetSubtopic,
        difficulty: nextDifficulty,
        previousQuestions: recentQuestionIds,
        userStrengths: strengths,
        userWeaknesses: weaknesses
      });
    } catch (error) {
      console.error('❌ Next question selection error:', error);

      // Fallback to a simple approach
      return this.getFallbackQuestion(currentTopic);
    }
  }

  /**
   * Calculate next question difficulty
   */
  calculateNextDifficulty(currentDifficulty, understanding) {
    const difficultyLevels = ['easy', 'medium', 'hard'];
    const currentIndex = difficultyLevels.indexOf(currentDifficulty);

    // Invalid current difficulty defaults to medium
    if (currentIndex === -1) return 'medium';

    // High understanding - consider increasing difficulty
    if (understanding >= 4) {
      return currentIndex < difficultyLevels.length - 1
        ? difficultyLevels[currentIndex + 1]
        : difficultyLevels[currentIndex];
    }

    // Low understanding - consider decreasing difficulty
    if (understanding <= 2) {
      return currentIndex > 0 ? difficultyLevels[currentIndex - 1] : difficultyLevels[currentIndex];
    }

    // Medium understanding - maintain current difficulty
    return currentDifficulty;
  }

  /**
   * Get user's recent question attempts
   */
  async getUserRecentAttempts(userId, limit = 10) {
    return executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('practice_attempts')
        .select(
          `
          id,
          question_id,
          understanding_rating,
          understanding_level,
          concepts_demonstrated,
          misconceptions,
          status,
          completed_at,
          practice_questions (
            topic,
            subtopic,
            difficulty,
            key_concepts
          )
        `
        )
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ User attempts fetch error:', error);
        return [];
      }

      return data || [];
    });
  }

  /**
   * Analyze user performance to identify strengths and weaknesses
   */
  async analyzeUserPerformance(userId, topic) {
    // Get all user attempts for this topic
    const attempts = await executeQuery(async (supabase) => {
      const { data, error } = await supabase
        .from('practice_attempts')
        .select(
          `
          understanding_rating,
          understanding_level,
          concepts_demonstrated,
          misconceptions,
          practice_questions (
            topic,
            subtopic,
            key_concepts
          )
        `
        )
        .eq('user_id', userId)
        .eq('status', 'completed')
        .not('understanding_rating', 'is', null);

      if (error) {
        console.error('❌ Performance analysis fetch error:', error);
        return [];
      }

      return data || [];
    });

    // Filter to topic-relevant attempts
    const topicAttempts = attempts.filter(
      (a) => a.practice_questions && a.practice_questions.topic === topic
    );

    if (topicAttempts.length === 0) {
      return { strengths: [], weaknesses: [] };
    }

    // Analyze concepts
    const conceptPerformance = {};

    topicAttempts.forEach((attempt) => {
      // Add demonstrated concepts as strengths
      if (attempt.concepts_demonstrated) {
        attempt.concepts_demonstrated.forEach((concept) => {
          if (!conceptPerformance[concept]) {
            conceptPerformance[concept] = { count: 0, score: 0 };
          }

          conceptPerformance[concept].count += 1;
          conceptPerformance[concept].score +=
            attempt.understanding_level || attempt.understanding_rating || 3;
        });
      }

      // Add misconceptions as weaknesses
      if (attempt.misconceptions) {
        attempt.misconceptions.forEach((concept) => {
          if (!conceptPerformance[concept]) {
            conceptPerformance[concept] = { count: 0, score: 0 };
          }

          conceptPerformance[concept].count += 1;
          conceptPerformance[concept].score -= 1; // Penalize misconceptions
        });
      }

      // Add question concepts if available
      if (attempt.practice_questions && attempt.practice_questions.key_concepts) {
        attempt.practice_questions.key_concepts.forEach((concept) => {
          if (!conceptPerformance[concept]) {
            conceptPerformance[concept] = { count: 0, score: 0 };
          }

          conceptPerformance[concept].count += 1;
          conceptPerformance[concept].score +=
            (attempt.understanding_level || attempt.understanding_rating || 3) - 3;
        });
      }
    });

    // Calculate average scores
    Object.keys(conceptPerformance).forEach((concept) => {
      const entry = conceptPerformance[concept];
      entry.average = entry.score / entry.count;
    });

    // Sort concepts by average score
    const sortedConcepts = Object.keys(conceptPerformance)
      .filter((c) => conceptPerformance[c].count >= 2) // Only consider concepts with enough data
      .sort((a, b) => conceptPerformance[b].average - conceptPerformance[a].average);

    // Get top strengths and weaknesses
    const strengths = sortedConcepts.filter((c) => conceptPerformance[c].average > 0).slice(0, 3);

    const weaknesses = sortedConcepts.filter((c) => conceptPerformance[c].average < 0).slice(0, 3);

    return { strengths, weaknesses };
  }

  /**
   * Get related topics for a given topic
   */
  async getRelatedTopics(topic) {
    // Map of related topics
    const topicRelations = {
      algebra: ['functions', 'equations', 'number_theory'],
      functions: ['algebra', 'calculus', 'graphs'],
      calculus: ['functions', 'limits', 'derivatives', 'integrals'],
      trigonometry: ['geometry', 'functions', 'identities'],
      geometry: ['trigonometry', 'vectors', 'coordinates'],
      statistics: ['probability', 'data_analysis', 'distributions'],
      probability: ['statistics', 'combinations', 'outcomes'],
      number_theory: ['algebra', 'integers', 'prime_numbers']
    };

    return topicRelations[topic] || [];
  }

  /**
   * Generate targeted feedback based on user's progress
   *
   * @param {string} userId - User ID
   * @param {string} topic - Current topic
   * @returns {string} Personalized feedback
   */
  async generateProgressFeedback(userId, topic) {
    try {
      // Get user's performance analytics
      const { strengths, weaknesses } = await this.analyzeUserPerformance(userId, topic);

      // Get recent attempts to calculate improvement
      const recentAttempts = await this.getUserRecentAttempts(userId, 5);

      if (recentAttempts.length === 0) {
        return `Keep practicing ${topic} problems to build your skills!`;
      }

      // Calculate average understanding
      const understandingScores = recentAttempts
        .map((a) => a.understanding_level || a.understanding_rating)
        .filter((score) => score !== null);

      const averageUnderstanding =
        understandingScores.length > 0
          ? understandingScores.reduce((sum, score) => sum + score, 0) / understandingScores.length
          : null;

      // Generate feedback based on performance
      let feedback = '';

      if (averageUnderstanding !== null) {
        if (averageUnderstanding >= 4) {
          feedback += `You're showing excellent understanding of ${topic}! `;
        } else if (averageUnderstanding >= 3) {
          feedback += `You're making good progress with ${topic}. `;
        } else {
          feedback += `You're building your foundation in ${topic}. Keep going! `;
        }
      }

      // Add strengths feedback
      if (strengths.length > 0) {
        feedback += `Your strengths include ${strengths.join(', ')}. `;
      }

      // Add areas for improvement
      if (weaknesses.length > 0) {
        feedback += `Focus on improving your understanding of ${weaknesses.join(', ')}. `;
      }

      // Add encouragement
      feedback += `Each practice question brings you closer to mastery!`;

      return feedback;
    } catch (error) {
      console.error('❌ Progress feedback generation error:', error);
      return `Keep practicing ${topic} problems consistently. Your understanding will grow with each attempt!`;
    }
  }
}

export const practiceService = new PracticeService();


