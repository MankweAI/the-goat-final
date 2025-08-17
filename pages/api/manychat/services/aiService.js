import { getOpenAIClient, OPENAI_CONFIG, GPT_PROMPTS } from '../config/openai.js';

export class AIService {
  constructor() {
    this.client = null;
    this.requestCount = 0;
  }

  async getClient() {
    if (!this.client) {
      this.client = getOpenAIClient();
    }
    return this.client;
  }

  // NEW: Analyze homework problem for method teaching
  async analyzeHomeworkProblem(userProfile, confusionText, context = {}) {
    try {
      console.log(
        `🔍 Analyzing homework problem for user ${userProfile.id}: "${confusionText.substring(0, 100)}"`
      );

      // Try cache first
      const cached = await gptCacheService.getCachedAnalysis(
        `homework_${context.problem_type}_${confusionText}`,
        userProfile.grade || '10',
        3 // Default priority for homework
      );

      if (cached) {
        this.cacheHits++;
        console.log(`✅ Homework analysis cache hit! (${this.cacheHits} hits today)`);
        return this.validateAnalysis(cached);
      }

      // Cache miss - generate new analysis
      const client = await this.getClient();
      const analysisPrompt = this.buildHomeworkAnalysisPrompt(userProfile, confusionText, context);

      const completion = await client.chat.completions.create({
        model: OPENAI_CONFIG.MODEL,
        messages: [
          { role: 'system', content: GPT_PROMPTS.HOMEWORK_ANALYSIS_SYSTEM },
          { role: 'user', content: analysisPrompt }
        ],
        max_tokens: 400,
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      this.requestCount++;

      const rawResponse = completion.choices[0].message.content.trim();
      const analysis = JSON.parse(rawResponse);
      const validatedAnalysis = this.validateAnalysis(analysis);

      // Cache the result
      await gptCacheService.cacheAnalysis(
        `homework_${context.problem_type}_${confusionText}`,
        userProfile.grade || '10',
        3,
        validatedAnalysis
      );

      console.log(`✅ New homework analysis generated and cached:`, {
        concepts: validatedAnalysis.concepts,
        confusion_type: validatedAnalysis.confusion_type,
        method_needed: validatedAnalysis.method_needed
      });

      return validatedAnalysis;
    } catch (error) {
      console.error('❌ Homework analysis failed:', error);
      return this.getFallbackHomeworkAnalysis(confusionText, context);
    }
  }

  // Build homework analysis prompt
  buildHomeworkAnalysisPrompt(userProfile, confusionText, context) {
    return `Analyze this student's homework confusion for method teaching:

STUDENT PROFILE:
- Grade: ${userProfile.grade || '10'}
- Subject: ${context.subject || 'Mathematics'}
- Problem Type: ${context.problem_type_display || 'General'}

STUDENT'S CONFUSION: "${confusionText}"

ANALYZE FOR METHOD TEACHING:
1. SPECIFIC CONCEPTS involved (e.g., quadratic formula, factoring, word problem setup)
2. TYPE OF CONFUSION:
   - conceptual: doesn't understand the underlying concept
   - procedural: knows concept but struggles with steps
   - applied: can't translate word problems to math
   - computational: makes calculation errors
3. METHOD NEEDED: What approach/strategy would help most
4. PREREQUISITE KNOWLEDGE: What they need to know first

IMPORTANT: This is for homework HELP, not homework SOLVING.
We teach methods and approaches, not give direct answers.

Respond in valid JSON format only:
{
  "concepts": ["specific math concepts involved"],
  "confusion_type": "conceptual|procedural|applied|computational",
  "method_needed": "what teaching approach would help most",
  "prerequisite_knowledge": ["concepts they might need to review first"],
  "teaching_focus": "most important thing to teach them",
  "confidence_score": 0.8
}`;
  }

  // Fallback for homework analysis
  getFallbackHomeworkAnalysis(confusionText, context) {
    const fallbackConcepts = this.extractBasicConcepts(confusionText);
    const problemType = context.problem_type || 'general';

    return {
      concepts: fallbackConcepts.length > 0 ? fallbackConcepts : [problemType],
      confusion_type: 'conceptual',
      method_needed: `step-by-step approach to ${problemType}`,
      prerequisite_knowledge: ['basic algebra'],
      teaching_focus: `understanding the method for ${problemType}`,
      reasoning: 'Fallback analysis for homework help'
    };
  }

  // Enhanced: Analyze student problem with caching
  async analyzeStudentProblem(userProfile, problemText, context = {}) {
    try {
      console.log(
        `🔍 Analyzing problem for user ${userProfile.id}: "${problemText.substring(0, 100)}"`
      );

      // Try cache first
      const cached = await gptCacheService.getCachedAnalysis(
        problemText,
        userProfile.grade || '10',
        context.stress_level || 3
      );

      if (cached) {
        this.cacheHits++;
        console.log(`✅ Cache hit! Using cached analysis (${this.cacheHits} hits today)`);
        return this.validateAnalysis(cached);
      }

      // Cache miss - generate new analysis
      const client = await this.getClient();
      const analysisPrompt = this.buildProblemAnalysisPrompt(userProfile, problemText, context);

      const completion = await client.chat.completions.create({
        model: OPENAI_CONFIG.MODEL,
        messages: [
          { role: 'system', content: GPT_PROMPTS.PROBLEM_ANALYSIS_SYSTEM },
          { role: 'user', content: analysisPrompt }
        ],
        max_tokens: 400,
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      this.requestCount++;

      const rawResponse = completion.choices[0].message.content.trim();
      const analysis = JSON.parse(rawResponse);
      const validatedAnalysis = this.validateAnalysis(analysis);

      // Cache the result
      await gptCacheService.cacheAnalysis(
        problemText,
        userProfile.grade || '10',
        context.stress_level || 3,
        validatedAnalysis
      );

      console.log(`✅ New analysis generated and cached:`, {
        concepts: validatedAnalysis.concepts,
        clarity: validatedAnalysis.clarity_level,
        needsFollowup: validatedAnalysis.follow_up_needed
      });

      return validatedAnalysis;
    } catch (error) {
      console.error('❌ Problem analysis failed:', error);
      return this.getFallbackAnalysis(problemText);
    }
  }

  // Enhanced: Generate follow-up question with caching
  async generateFollowUpQuestion(userProfile, analysis, previousFollowUps = []) {
    try {
      console.log(`🎯 Generating follow-up for concepts: ${analysis.concepts.join(', ')}`);

      // Try cache first
      const cached = await gptCacheService.getCachedFollowUp(
        analysis,
        userProfile.grade || '10',
        previousFollowUps
      );

      if (cached) {
        this.cacheHits++;
        console.log(`✅ Cache hit! Using cached follow-up (${this.cacheHits} hits today)`);
        return cached;
      }

      // Cache miss - generate new follow-up
      const client = await this.getClient();
      const followUpPrompt = this.buildFollowUpPrompt(userProfile, analysis, previousFollowUps);

      const completion = await client.chat.completions.create({
        model: OPENAI_CONFIG.MODEL,
        messages: [
          { role: 'system', content: GPT_PROMPTS.FOLLOWUP_SYSTEM },
          { role: 'user', content: followUpPrompt }
        ],
        max_tokens: 150,
        temperature: 0.7
      });

      this.requestCount++;
      const followUpQuestion = completion.choices[0].message.content.trim();

      // Validate and cache
      if (this.validateFollowUpQuestion(followUpQuestion)) {
        await gptCacheService.cacheFollowUp(analysis, userProfile.grade || '10', followUpQuestion);

        console.log(
          `✅ New follow-up generated and cached: "${followUpQuestion.substring(0, 50)}..."`
        );
        return followUpQuestion;
      } else {
        return this.getFallbackFollowUp(analysis);
      }
    } catch (error) {
      console.error('❌ Follow-up generation failed:', error);
      return this.getFallbackFollowUp(analysis);
    }
  }

  // Enhanced: Refine analysis with caching
  async refineAnalysis(initialAnalysis, followUpResponse, userProfile) {
    try {
      console.log(`🔄 Refining analysis with follow-up: "${followUpResponse.substring(0, 50)}"`);

      // Try cache first
      const cached = await gptCacheService.getCachedRefinement(initialAnalysis, followUpResponse);

      if (cached) {
        this.cacheHits++;
        console.log(`✅ Cache hit! Using cached refinement (${this.cacheHits} hits today)`);
        return this.validateAnalysis(cached);
      }

      // Cache miss - generate new refinement
      const client = await this.getClient();
      const refinementPrompt = this.buildRefinementPrompt(
        initialAnalysis,
        followUpResponse,
        userProfile
      );

      const completion = await client.chat.completions.create({
        model: OPENAI_CONFIG.MODEL,
        messages: [
          { role: 'system', content: GPT_PROMPTS.REFINEMENT_SYSTEM },
          { role: 'user', content: refinementPrompt }
        ],
        max_tokens: 300,
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      this.requestCount++;
      const refinedAnalysis = JSON.parse(completion.choices[0].message.content.trim());
      const validatedRefinement = this.validateAnalysis(refinedAnalysis);

      // Cache the result
      await gptCacheService.cacheRefinement(initialAnalysis, followUpResponse, validatedRefinement);

      console.log(`✅ New refinement generated and cached:`, {
        concepts: validatedRefinement.concepts,
        clarity: validatedRefinement.clarity_level,
      });

      return validatedRefinement;
    } catch (error) {
      console.error('❌ Analysis refinement failed:', error);
      // Return original analysis with updated clarity
      return {
        ...initialAnalysis,
        clarity_level: 'partial',
        follow_up_needed: false
      };
    }
  }

  // Build prompts for different analysis stages (unchanged)
  buildProblemAnalysisPrompt(userProfile, problemText, context) {
    return `Analyze this student's math problem description:

STUDENT PROFILE:
- Grade: ${userProfile.grade || '10'}
- Stress Level: ${context.stress_level || 3}/4
- Subject: Mathematics
- Previous Context: ${context.subject_choice || 'Not specified'}

STUDENT'S EXACT WORDS: "${problemText}"

ANALYZE FOR:
1. SPECIFIC CONCEPTS mentioned (e.g., derivatives, factoring, quadratics, logarithms)
2. TYPE OF CONFUSION:
   - conceptual: doesn't understand WHY or WHAT
   - procedural: doesn't know HOW to do steps
   - computational: makes calculation errors
   - applied: can't solve word problems
   - emotional: fear/anxiety blocking learning
3. CLARITY LEVEL: How specific is this problem description?
   - clear: Specific enough to create targeted help
   - needs_followup: Needs 1-2 questions to clarify
   - too_vague: Very general, needs guidance
4. EMOTIONAL MARKERS: frustrated, confused, afraid, overwhelmed, defeated

Respond in valid JSON format only:
{
  "concepts": ["array of specific math concepts"],
  "confusion_type": "one of: conceptual|procedural|computational|applied|emotional",
  "emotional_state": "primary emotion detected",
  "clarity_level": "one of: clear|needs_followup|too_vague",
  "follow_up_needed": true/false,
  "confidence_score": 0.8,
  "reasoning": "brief explanation of analysis"
}`;
  }

  buildFollowUpPrompt(userProfile, analysis, previousFollowUps) {
    return `Generate a targeted follow-up question to clarify this student's math struggle:

INITIAL PROBLEM: 
- Concepts: ${analysis.concepts.join(', ')}
- Confusion Type: ${analysis.confusion_type}
- Emotional State: ${analysis.emotional_state}

PREVIOUS FOLLOW-UPS ASKED: ${previousFollowUps.join(' | ') || 'None'}

GENERATE ONE FOLLOW-UP QUESTION that:
1. Helps narrow down their specific learning gap
2. Uses encouraging, calm tone
3. Offers 2-3 specific options when possible
4. Avoids repeating previous questions
5. Is appropriate for Grade ${userProfile.grade || '10'}

EXAMPLES OF GOOD FOLLOW-UPS:
- "Derivatives can be tricky! Is it understanding what they represent (like speed from distance), or is it more about the calculation steps?"
- "Algebra has many pieces. Do you get stuck with solving equations, or is it more about working with variables in general?"
- "Word problems are challenging! Do you struggle with reading them, setting up the math, or something else?"

Generate ONE targeted question only:`;
  }

  buildRefinementPrompt(initialAnalysis, followUpResponse, userProfile) {
    return `Refine the analysis of this student's math problem based on their follow-up response:

INITIAL ANALYSIS:
- Concepts: ${initialAnalysis.concepts.join(', ')}
- Confusion Type: ${initialAnalysis.confusion_type}
- Clarity Level: ${initialAnalysis.clarity_level}

STUDENT'S FOLLOW-UP RESPONSE: "${followUpResponse}"

REFINE THE ANALYSIS:
1. Update concepts based on new information
2. Refine confusion type if clarified
3. Determine if this is now specific enough for intervention
4. Assess confidence in the analysis

Respond in valid JSON format only:
{
  "concepts": ["refined array of specific concepts"],
  "confusion_type": "refined confusion type",
  "emotional_state": "updated emotional state",
  "clarity_level": "clear|needs_followup|too_vague",
  "follow_up_needed": true/false,
  "confidence_score": 0.9,
  "specific_gap": "precise description of what they don't understand",
  "intervention_focus": "what to target first"
}`;
  }

  // Validation and fallback methods (enhanced)
  validateAnalysis(analysis) {
    const validConfusionTypes = [
      'conceptual',
      'procedural',
      'computational',
      'applied',
      'emotional'
    ];
    const validClarityLevels = ['clear', 'needs_followup', 'too_vague'];

    return {
      concepts: Array.isArray(analysis.concepts) ? analysis.concepts : ['general'],
      confusion_type: validConfusionTypes.includes(analysis.confusion_type)
        ? analysis.confusion_type
        : 'conceptual',
      emotional_state: analysis.emotional_state || 'neutral',
      clarity_level: validClarityLevels.includes(analysis.clarity_level)
        ? analysis.clarity_level
        : 'needs_followup',
      follow_up_needed: Boolean(analysis.follow_up_needed),
      specific_gap: analysis.specific_gap || '',
      intervention_focus: analysis.intervention_focus || '',
      method_needed: analysis.method_needed || '',
      prerequisite_knowledge: Array.isArray(analysis.prerequisite_knowledge)
        ? analysis.prerequisite_knowledge
        : [],
      teaching_focus: analysis.teaching_focus || '',
      reasoning: analysis.reasoning || ''
    };
  }

  validateFollowUpQuestion(question) {
    return (
      question &&
      question.length > 20 &&
      question.length < 200 &&
      question.includes('?') &&
      !question.toLowerCase().includes('error')
    );
  }

  getFallbackAnalysis(problemText) {
    const fallbackConcepts = this.extractBasicConcepts(problemText);

    return {
      concepts: fallbackConcepts,
      confusion_type: 'conceptual',
      emotional_state: 'confused',
      clarity_level: 'needs_followup',
      follow_up_needed: true,
      specific_gap: '',
      intervention_focus: '',
      reasoning: 'Fallback analysis due to processing error'
    };
  }

  getFallbackFollowUp(analysis) {
    const concept = analysis.concepts[0] || 'this topic';
    return `${concept} can be challenging! Can you tell me what specifically feels confusing about it?`;
  }

  extractBasicConcepts(text) {
    const mathConcepts = [
      'algebra',
      'equations',
      'variables',
      'functions',
      'quadratics',
      'calculus',
      'derivatives',
      'integrals',
      'limits',
      'trigonometry',
      'sin',
      'cos',
      'tan',
      'angles',
      'geometry',
      'shapes',
      'area',
      'volume',
      'proofs',
      'statistics',
      'probability',
      'data',
      'graphs'
    ];

    const lowerText = text.toLowerCase();
    return mathConcepts.filter((concept) => lowerText.includes(concept)).slice(0, 3);
  }

  // Enhanced analytics with cache performance
  getUsageStats() {
    return {
      requestCount: this.requestCount,
      cacheHits: this.cacheHits,
      cacheHitRate:
        this.requestCount > 0 ? (this.cacheHits / (this.requestCount + this.cacheHits)) * 100 : 0,
      estimatedCostSavings: this.cacheHits * 0.001, // Rough estimate
      model: OPENAI_CONFIG.MODEL
    };
  }

  // All other existing methods remain unchanged...
  async generateExplanation(questionData, userAnswer, correctAnswer, userProfile) {
    try {
      console.log(`🤖 Generating GPT explanation for user ${userProfile.id}`);

      const client = await this.getClient();
      const userPrompt = this.buildExplanationPrompt(
        questionData,
        userAnswer,
        correctAnswer,
        userProfile
      );

      const completion = await client.chat.completions.create({
        model: OPENAI_CONFIG.MODEL,
        messages: [
          { role: 'system', content: GPT_PROMPTS.EXPLANATION_SYSTEM },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: OPENAI_CONFIG.MAX_TOKENS,
        temperature: OPENAI_CONFIG.TEMPERATURE
      });

      this.requestCount++;
      console.log(`✅ GPT explanation generated (${this.requestCount} requests today)`);

      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error('❌ OpenAI API Error:', error);

      if (OPENAI_CONFIG.FALLBACK_ON_ERROR) {
        return this.generateFallbackExplanation(questionData, userAnswer, correctAnswer);
      }

      throw error;
    }
  }

  buildExplanationPrompt(questionData, userAnswer, correctAnswer, userProfile) {
    const choices = this.parseChoices(questionData.choices);
    const choicesText = choices.map((c) => `${c.choice}) ${c.text}`).join('\n');

    return `Student Profile:
- Grade: ${userProfile.grade || '10'}
- Subject: ${questionData.topic || 'Math'}
- Accuracy Rate: ${Math.round((userProfile.correct_answer_rate || 0.5) * 100)}%

Question: ${questionData.question_text}

Answer Choices:
${choicesText}

Correct Answer: ${correctAnswer}
Student's Answer: ${userAnswer}
Difficulty: ${questionData.difficulty}

Task: Explain why the student's answer was wrong and teach the correct approach. Be encouraging and use South African youth slang naturally.`;
  }

  async generateChallengeMessage(challengerName, challengedName, subject, questionTopic) {
    try {
      const client = await this.getClient();

      const userPrompt = `Generate a playful challenge message:

${challengerName} is challenging ${challengedName} in ${subject} (topic: ${questionTopic}).

Requirements:
- Use South African slang naturally (sharp, eish, boet, lekker)
- Keep it friendly and motivational  
- Include fire emoji 🔥
- Max 50 words
- Make it exciting but supportive

Example: "Eish @sarah, @mike thinks he's sharper than you at algebra! 🔥 Show him what your brain can do!"`;

      const completion = await client.chat.completions.create({
        model: OPENAI_CONFIG.MODEL,
        messages: [
          { role: 'system', content: GPT_PROMPTS.CHALLENGE_SYSTEM },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 100,
        temperature: 0.8
      });

      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error('❌ Challenge message generation failed:', error);
      return `🔥 @${challengedName}, @${challengerName} has challenged you in ${subject}! Show them your skills! 💪`;
    }
  }

  async generateMotivationalMessage(userProfile, context = 'general') {
    try {
      const client = await this.getClient();

      const contextPrompts = {
        streak: `Generate encouragement for a ${userProfile.streak_count}-question streak`,
        comeback: 'Generate motivation after getting a question wrong',
        achievement: 'Generate celebration for reaching a milestone',
        general: 'Generate general study motivation'
      };

      const userPrompt = `${contextPrompts[context] || contextPrompts.general}

User Info:
- Username: ${userProfile.username}
- Current streak: ${userProfile.streak_count}
- Accuracy: ${Math.round((userProfile.correct_answer_rate || 0.5) * 100)}%
- Grade: ${userProfile.grade}

Generate a brief, encouraging message using South African youth slang. Keep it under 30 words.`;

      const completion = await client.chat.completions.create({
        model: OPENAI_CONFIG.MODEL,
        messages: [
          { role: 'system', content: GPT_PROMPTS.MOTIVATION_SYSTEM },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 80,
        temperature: 0.8
      });

      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error('❌ Motivational message generation failed:', error);

      const fallbacks = {
        streak: `🔥 ${userProfile.streak_count} in a row! You're on fire!`,
        comeback: `No stress! Every mistake is a step forward! 💪`,
        achievement: `Lekker work! You're getting sharper every day! ⭐`,
        general: `Keep pushing, @${userProfile.username}! You've got this! 🚀`
      };

      return fallbacks[context] || fallbacks.general;
    }
  }

  async generateTherapySupport(userProfile, reason, preConfidence) {
    try {
      const client = await this.getClient();
      const userPrompt = `Student context:
- Username: ${userProfile.username || 'student'}
- Grade: ${userProfile.grade || '10'}
- Reason: ${reason}
- Confidence (1-5): ${preConfidence}

Write one micro-support line (≤30 words) that validates and gives one tiny step. Keep SA slang natural. Max 2 emojis.`;

      const completion = await client.chat.completions.create({
        model: OPENAI_CONFIG.MODEL,
        messages: [
          { role: 'system', content: GPT_PROMPTS.THERAPY_SYSTEM },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 64,
        temperature: 0.7
      });

      this.requestCount++;
      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error('❌ Therapy micro-support failed:', error);
      return `Eish, it happens. Breathe, then try one small step: 1 easy maths question. Sharp, you've got this. 💪`;
    }
  }

  generateFallbackExplanation(questionData, userAnswer, correctAnswer) {
    const topic = questionData.topic || 'this concept';

    return `🧠 The correct answer was ${correctAnswer}.

💡 Quick tip: Review ${topic} concepts and try another question!

Keep going, you're getting sharper! 💪`;
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
}

// Singleton instance
export const aiService = new AIService();