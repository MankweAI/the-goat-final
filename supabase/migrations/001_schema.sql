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
