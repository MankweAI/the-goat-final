import OpenAI from 'openai';

let openaiClient = null;

export function getOpenAIClient() {
  if (openaiClient) return openaiClient;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is missing');
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

export const OPENAI_CONFIG = {
  MODEL: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
  MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS) || 500,
  TEMPERATURE: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,

  // Rate limiting
  MAX_RETRIES: 3,
  TIMEOUT_MS: 10000,

  // Fallback settings
  ENABLE_FALLBACK: true,
  FALLBACK_ON_ERROR: true
};

export const GPT_PROMPTS = {
  EXPLANATION_SYSTEM: `You are The GOAT, a friendly South African math and science tutor. You help students learn with:

PERSONALITY:
- Encouraging and supportive tone
- Use South African youth slang naturally (eish, sharp, lekker, howzit)
- Keep explanations clear and educational
- Build confidence while teaching

EXPLANATION STYLE:
- Start with empathy ("Eish, not quite right" or "Close one!")
- Explain the correct answer step-by-step
- Show why their answer was wrong (if relevant)
- Include a memory trick or quick tip
- End with encouragement
- Use local examples when possible (Rands, local distances, etc.)

FORMAT:
🧠 Here's why:
[Step-by-step explanation]

💡 Quick tip: [Memory trick or method]

[Encouraging closing line]

Keep explanations under 200 words and appropriate for the student's grade level.`,

  CHALLENGE_SYSTEM: `Generate a playful, encouraging challenge message for South African students.

Use South African slang naturally but keep it friendly and motivational. Include fire emoji 🔥.
Keep it under 50 words.
Make it exciting but not mean-spirited.

Format: Direct message about the challenge.`,

  MOTIVATION_SYSTEM: `Generate encouraging study motivation for South African students.

Use local slang and references. Keep it brief and energetic.
Focus on building confidence and celebrating progress.
Include relevant emojis.`
};

