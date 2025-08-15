import OpenAI from 'openai';

let openaiClient = null;

export function getOpenAIClient() {
  if (openaiClient) return openaiClient;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.length < 10 || !apiKey.startsWith('sk-')) {
    throw new Error('Invalid or missing OPENAI_API_KEY environment variable');
  }

  try {
    openaiClient = new OpenAI({
      apiKey,
      timeout: OPENAI_CONFIG.TIMEOUT_MS,
      maxRetries: OPENAI_CONFIG.MAX_RETRIES
    });
    console.log('✅ OpenAI client initialized successfully');
    return openaiClient;
  } catch (error) {
    console.error('❌ Failed to initialize OpenAI client:', error);
    throw new Error(`OpenAI initialization failed: ${error.message}`);
  }
}

export const OPENAI_CONFIG = {
  MODEL: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
  MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS) || 500,
  TEMPERATURE: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,

  MAX_RETRIES: 3,
  TIMEOUT_MS: 15000,

  ENABLE_FALLBACK: true,
  FALLBACK_ON_ERROR: true,

  RATE_LIMIT_PER_MINUTE: 50,
  COST_LIMIT_PER_DAY: 10.0
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

export async function testOpenAIConnection() {
  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Test connection' }],
      max_tokens: 5
    });
    if (response.choices && response.choices.length > 0) {
      console.log('✅ OpenAI connection test successful');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ OpenAI connection test failed:', error);
    return false;
  }
}
