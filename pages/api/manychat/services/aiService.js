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

      // Fallback motivational messages
      const fallbacks = {
        streak: `🔥 ${userProfile.streak_count} in a row! You're on fire!`,
        comeback: `No stress! Every mistake is a step forward! 💪`,
        achievement: `Lekker work! You're getting sharper every day! ⭐`,
        general: `Keep pushing, @${userProfile.username}! You've got this! 🚀`
      };

      return fallbacks[context] || fallbacks.general;
    }
  }

  // NEW: micro-support for therapy (≤30 words)
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
      // fallback line
      return `Eish, it happens. Breathe, then try one small step: 1 easy maths question. Sharp, you’ve got this. 💪`;
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

  // Analytics method
  getUsageStats() {
    return {
      requestCount: this.requestCount,
      estimatedCost: this.requestCount * 0.001, // Rough estimate
      model: OPENAI_CONFIG.MODEL
    };
  }
}

// Singleton instance
export const aiService = new AIService();
