# Bootstrap script for "The GOAT" project (Phase 0 + Phase 1 scaffolding)
# Usage: powershell -ExecutionPolicy Bypass -File .\bootstrap-project.ps1

function Write-File($Path, $Content) {
  if (Test-Path $Path) {
    Write-Host "SKIP (exists): $Path"
  } else {
    $dir = Split-Path $Path -Parent
    if ($dir -and -not (Test-Path $dir)) {
      New-Item -ItemType Directory -Path $dir | Out-Null
    }
    $Content | Out-File -FilePath $Path -Encoding UTF8
    Write-Host "CREATED: $Path"
  }
}

# Root files
Write-File ".gitignore" @"
# Dependencies
node_modules
# Env
.env*
!.env.local.example
# Build
.next
out
# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
# Misc
.DS_Store
"@

Write-File "package.json" @"
{
  "name": "the-goat",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --ext .js,.jsx",
    "format": "prettier --write .",
    "test": "jest"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.43.1",
    "axios": "^1.7.2",
    "envalid": "^8.0.0",
    "next": "14.2.4",
    "pino": "^9.0.0",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "eslint": "^9.4.0",
    "eslint-config-next": "14.2.4",
    "jest": "^29.7.0",
    "prettier": "^3.3.3"
  },
  "engines": {
    "node": ">=18.18.0"
  }
}
"@

Write-File ".env.local.example" @"
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
MANYCHAT_API_TOKEN=
MANYCHAT_API_BASE=https://api.manychat.com/fb
EMA_ALPHA=0.2
DIFF_EASY_MAX=0.38
DIFF_MED_MAX=0.72
DIFF_HYSTERESIS=0.03
ANSWER_STALE_MINUTES=30
RATE_LIMIT_WINDOW_SEC=10
RATE_LIMIT_MAX=8
DEDUP_WINDOW_SEC=20
DEFAULT_TOPIC=algebra
TOPIC_PROMPT_RETRY_LIMIT=2
"@

Write-File "README.md" @"
# The GOAT
WhatsApp-driven diagnostic math practice bot (Next.js + Supabase + ManyChat).

## Quick Start
1. Copy .env.local.example to .env.local and fill values.
2. npm install
3. Run migrations in Supabase (files under supabase/migrations).
4. npm run dev

## Webhook
POST /api/webhook/manychat
Body: { psid: string, message: string }

## Health
GET /api/health
"@

Write-File ".editorconfig" @"
root = true
[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
"@

Write-File ".prettierrc" @"
{
  "singleQuote": true,
  "semi": true,
  "tabWidth": 2,
  "printWidth": 100,
  "trailingComma": "none"
}
"@

Write-File ".eslintrc.cjs" @"
module.exports = {
  root: true,
  extends: ['next', 'next/core-web-vitals'],
  rules: {
    'no-console': ['warn', { allow: ['error', 'warn'] }]
  }
};
"@

Write-File "jest.config.js" @"
export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['js', 'json'],
  collectCoverageFrom: ['lib/**/*.js']
};
"@

# Pages
Write-File "pages/index.js" @"
export default function Home() {
  return <div>The GOAT backend operational. Webhook at /api/webhook/manychat</div>;
}
"@

# API health
Write-File "pages/api/health.js" @"
export default function handler(req, res) {
  return res.status(200).json({ ok: true, ts: new Date().toISOString() });
}
"@

# Placeholder Webhook (will be replaced with full Phase 3 logic)
Write-File "pages/api/webhook/manychat.js" @"
/**
 * Placeholder for Phase 3 final implementation.
 * This minimal version just echoes and ensures structure is in place.
 * Replace with the full topic-aware diagnostic engine code next.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const { psid, message } = req.body || {};
  if (!psid || !message) {
    return res.status(400).json({ error: 'Invalid body' });
  }
  return res.status(200).json({ status: 'placeholder', received: { psid, message } });
}
"@

# Lib files
Write-File "lib/config.js" @"
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
"@

Write-File "lib/supabaseClient.js" @"
import { createClient } from '@supabase/supabase-js';
import { env } from './config';

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});
"@

Write-File "lib/log.js" @"
import pino from 'pino';
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['req.headers.authorization', 'config.supabase.serviceKey']
});
"@

Write-File "lib/difficulty.js" @"
import { env } from './config';

export function clamp(n, min = 0, max = 1) {
  return Math.min(max, Math.max(min, n));
}

export function updateRate(oldRate, isCorrect) {
  const next = env.EMA_ALPHA * (isCorrect ? 1 : 0) + (1 - env.EMA_ALPHA) * oldRate;
  return Math.round(clamp(next) * 1000) / 1000;
}

export function selectDifficulty(rate, previous) {
  let target;
  if (rate < env.DIFF_EASY_MAX) target = 'easy';
  else if (rate <= env.DIFF_MED_MAX) target = 'medium';
  else target = 'hard';

  if (previous && previous !== target) {
    // Hysteresis enforcement
    if (previous === 'easy' && rate < env.DIFF_EASY_MAX + env.DIFF_HYSTERESIS) target = 'easy';
    if (previous === 'hard' && rate > env.DIFF_MED_MAX - env.DIFF_HYSTERESIS) target = 'hard';
    if (previous === 'medium') {
      if (rate >= env.DIFF_EASY_MAX - env.DIFF_HYSTERESIS && rate <= env.DIFF_MED_MAX + env.DIFF_HYSTERESIS) {
        target = 'medium';
      }
    }
  }
  return target;
}
"@

Write-File "lib/topic.js" @"
export const TOPIC_ALIASES = {
  algebra: ['algebra', 'alg'],
  trig: ['trig', 'trigonometry'],
  geometry: ['geometry', 'geo']
};

export function normalizeTopic(input) {
  if (!input) return null;
  const cleaned = input.trim().toLowerCase();
  for (const canonical of Object.keys(TOPIC_ALIASES)) {
    if (canonical === cleaned) return canonical;
    if (TOPIC_ALIASES[canonical].includes(cleaned)) return canonical;
  }
  return null;
}
"@

# Tests
Write-File "tests/unit/difficulty.test.js" @"
import { updateRate, selectDifficulty } from '../../lib/difficulty.js';

describe('difficulty helpers', () => {
  test('updateRate moves toward 1 on correct', () => {
    const r = updateRate(0.5, true);
    expect(r).toBeGreaterThan(0.5);
  });
  test('updateRate moves toward 0 on incorrect', () => {
    const r = updateRate(0.5, false);
    expect(r).toBeLessThan(0.5);
  });
  test('selectDifficulty basic bands', () => {
    expect(selectDifficulty(0.2, null)).toBe('easy');
    expect(selectDifficulty(0.5, null)).toBe('medium');
    expect(selectDifficulty(0.9, null)).toBe('hard');
  });
});
"@

Write-File "tests/unit/topic.test.js" @"
import { normalizeTopic } from '../../lib/topic.js';

describe('topic normalization', () => {
  test('exact match', () => {
    expect(normalizeTopic('algebra')).toBe('algebra');
  });
  test('alias match', () => {
    expect(normalizeTopic('alg')).toBe('algebra');
  });
  test('unknown', () => {
    expect(normalizeTopic('history')).toBeNull();
  });
});
"@

Write-File "tests/integration/README.md" @"
# Integration Tests
Add integration tests here once the webhook route is fully implemented (Phase 3).
"@

# Docs
Write-File "docs/OPERATIONS-PLAN.md" @"
(Placeholder) See master Operations Plan with Topic Selection Extension. Replace with full content or symlink.
"@

# Supabase migrations
Write-File "supabase/migrations/001_schema.sql" @"
CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";
CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_psid text UNIQUE NOT NULL,
  current_topic text NULL,
  current_question_id uuid NULL,
  current_question_served_at timestamptz NULL,
  correct_answer_rate numeric NOT NULL DEFAULT 0.5,
  streak_count int NOT NULL DEFAULT 0,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mcqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  difficulty text NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
  question_text text NOT NULL,
  image_url text NULL,
  choices jsonb NOT NULL,
  correct_choice text NOT NULL CHECK (correct_choice IN ('A','B','C','D')),
  last_served_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_weaknesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mcq_id uuid NOT NULL REFERENCES public.mcqs(id) ON DELETE CASCADE,
  weakness_tag text NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mcq_id uuid NOT NULL REFERENCES public.mcqs(id) ON DELETE CASCADE,
  chosen_choice text NOT NULL CHECK (chosen_choice IN ('A','B','C','D')),
  is_correct boolean NOT NULL,
  weakness_tag text NULL,
  latency_ms int NULL,
  answered_at timestamptz NOT NULL DEFAULT now()
);
"@

Write-File "supabase/migrations/002_indexes.sql" @"
CREATE INDEX IF NOT EXISTS users_whatsapp_psid_idx ON public.users(whatsapp_psid);
CREATE INDEX IF NOT EXISTS users_current_topic_idx ON public.users(current_topic) WHERE current_topic IS NOT NULL;
CREATE INDEX IF NOT EXISTS mcqs_difficulty_last_served_idx ON public.mcqs(difficulty, last_served_at);
CREATE INDEX IF NOT EXISTS mcqs_difficulty_topic_last_served_idx ON public.mcqs(difficulty, topic, last_served_at);
CREATE INDEX IF NOT EXISTS mcqs_easy_last_served_idx ON public.mcqs(last_served_at) WHERE difficulty='easy';
CREATE INDEX IF NOT EXISTS mcqs_medium_last_served_idx ON public.mcqs(last_served_at) WHERE difficulty='medium';
CREATE INDEX IF NOT EXISTS mcqs_hard_last_served_idx ON public.mcqs(last_served_at) WHERE difficulty='hard';
CREATE INDEX IF NOT EXISTS user_weaknesses_user_idx ON public.user_weaknesses(user_id);
CREATE INDEX IF NOT EXISTS user_weaknesses_tag_idx ON public.user_weaknesses(weakness_tag);
CREATE INDEX IF NOT EXISTS user_answers_user_answered_idx ON public.user_answers(user_id, answered_at DESC);
CREATE INDEX IF NOT EXISTS user_answers_mcq_idx ON public.user_answers(mcq_id);
"@

Write-File "supabase/migrations/003_rpc_next_mcq.sql" @"
DROP FUNCTION IF EXISTS public.next_mcq(text, uuid, text, integer, integer);
CREATE OR REPLACE FUNCTION public.next_mcq(
  p_difficulty text,
  p_user_id uuid,
  p_topic text DEFAULT NULL,
  p_exclude_recent integer DEFAULT 10,
  p_recent_days integer DEFAULT 7
)
RETURNS public.mcqs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mcq public.mcqs%ROWTYPE;
BEGIN
  SELECT *
  INTO v_mcq
  FROM public.mcqs m
  WHERE m.difficulty = p_difficulty
    AND (p_topic IS NULL OR m.topic = p_topic)
    AND m.id NOT IN (
      SELECT ua.mcq_id
      FROM public.user_answers ua
      WHERE ua.user_id = p_user_id
      ORDER BY ua.answered_at DESC
      LIMIT p_exclude_recent
    )
    AND m.id NOT IN (
      SELECT ua2.mcq_id
      FROM public.user_answers ua2
      WHERE ua2.user_id = p_user_id
        AND ua2.answered_at > now() - (p_recent_days || ' days')::interval
    )
  ORDER BY m.last_served_at ASC NULLS FIRST, m.id
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_mcq.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.mcqs
  SET last_served_at = now()
  WHERE id = v_mcq.id
  RETURNING * INTO v_mcq;

  RETURN v_mcq;
END;
$$;
"@

Write-File "supabase/migrations/004_seed_mcqs.sql" @"
INSERT INTO public.mcqs (topic, difficulty, question_text, choices, correct_choice)
VALUES
('algebra','easy',
 'Solve: 2x + 3 = 11. What is x?',
 '{
   \"A\":{\"text\":\"3\",\"weakness_tag\":\"linear_isolation\"},
   \"B\":{\"text\":\"4\",\"weakness_tag\":\"none\"},
   \"C\":{\"text\":\"5\",\"weakness_tag\":\"addition_error\"},
   \"D\":{\"text\":\"8\",\"weakness_tag\":\"coefficient_misread\"}
 }','B'),
('algebra','medium',
 'Simplify: (x^2 - 9)/(x - 3)',
 '{
   \"A\":{\"text\":\"x + 3\",\"weakness_tag\":\"factor_cancel\"},
   \"B\":{\"text\":\"x - 3\",\"weakness_tag\":\"sign_error\"},
   \"C\":{\"text\":\"x^2 - 3\",\"weakness_tag\":\"incomplete_factor\"},
   \"D\":{\"text\":\"x + 9\",\"weakness_tag\":\"incorrect_factor\"}
 }','A'),
('trig','easy',
 'What is sin(30°)?',
 '{
   \"A\":{\"text\":\"1/2\",\"weakness_tag\":\"none\"},
   \"B\":{\"text\":\"√3/2\",\"weakness_tag\":\"swap_values\"},
   \"C\":{\"text\":\"1\",\"weakness_tag\":\"unit_circle_confuse\"},
   \"D\":{\"text\":\"0\",\"weakness_tag\":\"axis_confuse\"}
 }','A'),
('geometry','hard',
 'Area of a circle with circumference 8π?',
 '{
   \"A\":{\"text\":\"16π\",\"weakness_tag\":\"misapply_formula\"},
   \"B\":{\"text\":\"4π\",\"weakness_tag\":\"radius_square_error\"},
   \"C\":{\"text\":\"8π\",\"weakness_tag\":\"circumference_confuse\"},
   \"D\":{\"text\":\"64π\",\"weakness_tag\":\"square_circumference_misuse\"}
 }','A');
"@

Write-Host "`nAll done. Next steps:"
Write-Host "1) Open project in VSCode."
Write-Host "2) Copy .env.local.example to .env.local and fill values."
Write-Host "3) Run migrations in Supabase (paste SQL)."
Write-Host "4) npm install && npm run dev"