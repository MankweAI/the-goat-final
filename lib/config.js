import { cleanEnv, str, num } from 'envalid';

export const env = cleanEnv(process.env, {
  SUPABASE_URL: str(),
  SUPABASE_SERVICE_ROLE_KEY: str(),
  MANYCHAT_API_TOKEN: str(),
  MANYCHAT_API_BASE: str({ default: 'https://api.manychat.com/fb' }),
  EMA_ALPHA: num({ default: 0.2 }),
  DIFF_EASY_MAX: num({ default: 0.38 }),
  DIFF_MED_MAX: num({ default: 0.72 }),
  DIFF_HYSTERESIS: num({ default: 0.03 }),
  ANSWER_STALE_MINUTES: num({ default: 30 }),
  RATE_LIMIT_WINDOW_SEC: num({ default: 10 }),
  RATE_LIMIT_MAX: num({ default: 8 }),
  DEDUP_WINDOW_SEC: num({ default: 20 }),
  DEFAULT_TOPIC: str({ default: 'algebra' }),
  TOPIC_PROMPT_RETRY_LIMIT: num({ default: 2 })
});
