/**
 * The GOAT Bot - Stress & Confidence Support (Rebranded)
 * Updated: 2025-08-16 16:53:38 UTC
 * Focus: Patient tutor + psychologist approach, proactive learning
 */

// Core messaging with calm, supportive tone
export const MESSAGES = {
  ERRORS: {
    GENERIC: "Something went wrong. Let's try again in a moment. ✨",
    DATABASE: 'Connection hiccup. Give it a sec and try again. 🌱',
    VALIDATION: "That doesn't look right. Check your input and try again. 🧠",
    INVALID_ANSWER: 'Send A, B, C, or D for multiple choice questions.\n\nTry again! ✅',
    INVALID_MENU_OPTION: 'Pick a valid number from the options above. 🎯',
    NO_QUESTION_ACTIVE: 'Type "practice" to start practicing! 🧮',
    QUESTION_EXPIRED: 'Let\'s get a fresh question. Type "practice"! 🔄'
  },

  WELCOME: {
    // New triage menu - core of the rebrand
    MAIN_MENU:
      `Welcome. I'm here to help you study with calm and clarity.\n\n` +
      `What do you need right now?\n\n` +
      `1️⃣ I'm too stressed 😰\n` +
      `2️⃣ I doubt myself 🫶\n` +
      `3️⃣ I need more practice 🧮\n\n` +
      `Just pick a number! ✨`,

    // Contextual prompts when needed
    GRADE_PROMPT:
      `Which grade are you in?\n\n` +
      `📚 Options:\n` +
      `• 10, 11\n` +
      `• varsity (for university)\n\n` +
      `Just type your grade! 🎓`,

    SUBJECT_PROMPT:
      `Maths is ready now; other subjects coming soon.\n\n` +
      `Start with Maths? Type "yes" to continue! 💪`
  },

  // Stress support (formerly "Panic")
  STRESS: {
    LEVEL_PROMPT:
      `How stressed are you right now? (1–4)\n\n` +
      `1️⃣ It's that bad\n` +
      `2️⃣ It's bad\n` +
      `3️⃣ Not that bad\n` +
      `4️⃣ It's ok, I guess`,

    SUBJECT_PROMPT:
      `Let's focus on one subject to start.\n\n` +
      `Which subject is causing stress?\n\n` +
      `1️⃣ Mathematics\n` +
      `2️⃣ Physics (Maths ready now)\n` +
      `3️⃣ Chemistry (Maths ready now)\n` +
      `4️⃣ Life Sciences (Maths ready now)`,

    EXAM_DATE_PROMPT:
      `When is your test/exam? (e.g., 22 Aug 7pm)\n\n` + `If you're not sure, say "skip". ⏳`,

    PLAN_OFFER_LONG:
      `I can send a short lesson + practice each day until then.\n\n` +
      `Want that? Type "yes" or "no". 📅`,

    PLAN_OFFER_SHORT:
      `Let's keep it light: short review + a few practice questions + a calm checklist.\n\n` +
      `Ready to start? Type "yes"! 🌱`,

    TIME_PROMPT:
      `What time suits you daily? (e.g., 7pm)\n\n` + `I'll send gentle reminders at that time. ⏰`,

    VALIDATION_HIGH: `I hear you. Let's breathe once. We'll take one small step together. 🌱`,
    VALIDATION_LOW: `You're handling this well. Let's build on that steady energy. ✨`
  },

  // Confidence support (formerly "Therapy")
  CONFIDENCE: {
    REASON_PROMPT:
      `Tell me what's weighing on you:\n\n` +
      `1️⃣ I failed something\n` +
      `2️⃣ I'm confused about concepts\n` +
      `3️⃣ I keep comparing to others\n` +
      `4️⃣ Someone's comment hurt\n` +
      `5️⃣ Other`,

    PRE_CONFIDENCE_PROMPT:
      `On a scale 1–5, how confident do you feel right now?\n\n` + `1️⃣ Very low ... 5️⃣ Very high`,

    LADDER_PROMPT:
      `Here's your confidence ladder. Pick a step:\n\n` +
      `1️⃣ Gentle practice (easy wins)\n` +
      `2️⃣ Explain something you know\n` +
      `3️⃣ One medium challenge\n` +
      `4️⃣ Skip to check-in`,

    POST_CONFIDENCE_PROMPT: `How's your confidence now (1–5)?`,

    REFLECTION_PROMPT:
      `Think of a maths concept you're solid in (e.g., factorising).\n\n` +
      `Explain it in one sentence to yourself. That's your proof you can learn.\n\n` +
      `Now rate your confidence again (1–5). 🧠`
  },

  LESSONS: {
    CALCULUS_INTRO:
      `📘 Calculus (First Principles) – Micro‑Module\n\n` +
      `• Pattern: f'(x) = lim_{h→0} (f(x+h) − f(x)) / h\n` +
      `• Simplify: Expand, cancel, factor h, then take the limit\n` +
      `• Timing: Go step‑by‑step; don't skip algebra\n\n` +
      `Quick lesson:\n` +
      `For f(x) = x^2:\n` +
      `f(x+h) = x^2 + 2xh + h^2\n` +
      `f(x+h) − f(x) = 2xh + h^2\n` +
      `Divide by h → 2x + h\n` +
      `Limit as h→0 → 2x\n\n` +
      `Worked example:\n` +
      `f(x) = 3x^2\n` +
      `f(x+h) − f(x) = 3(2xh + h^2)\n` +
      `Divide by h → 3(2x + h)\n` +
      `Limit h→0 → 6x\n\n` +
      `1️⃣ Start Practice\n` +
      `2️⃣ Another example\n` +
      `3️⃣ Cancel`,

    TRIGONOMETRY_INTRO:
      `📗 Trigonometry Identity – Micro‑Module\n\n` +
      `• Core: sin²(x) + cos²(x) = 1\n` +
      `• Strategy: Convert everything to sin and cos\n` +
      `• Tip: Watch angle units and common values\n\n` +
      `Quick lesson:\n` +
      `Use sin² + cos² = 1 to reduce expressions.\n` +
      `Given 1 − cos²(x) = sin²(x)\n\n` +
      `Worked example:\n` +
      `Simplify: (1 − cos²x)/sin x = sin²x / sin x = sin x\n\n` +
      `1️⃣ Start Practice\n` +
      `2️⃣ Another example\n` +
      `3️⃣ Cancel`
  },

  FEEDBACK: {
    CORRECT_SIMPLE: `You got it right. Well done! ✅`,
    INCORRECT_SIMPLE: `Not quite yet, and that's okay. The idea is landing. 🌱`,
    BREATHING_CUE: `Inhale 4, exhale 4. Ready? 🫶`
  },

  PRACTICE: {
    START_PROMPT: `Ready to try a few? I'll keep it gentle. 🧮`,
    CONTINUE_MENU:
      `What next?\n\n` +
      `1️⃣ Continue same topic\n` +
      `2️⃣ Switch topic\n` +
      `3️⃣ Take a short break\n` +
      `4️⃣ Remind me tonight\n\n` +
      `Pick a number! ✨`
  }
};

export const CONSTANTS = {
  // Stress levels (simplified from 5 to 4)
  STRESS_LEVELS: {
    VERY_HIGH: 1, // "It's that bad"
    HIGH: 2, // "It's bad"
    MEDIUM: 3, // "Not that bad"
    LOW: 4 // "It's ok, I guess"
  },

  // Confidence levels (1-5 scale)
  CONFIDENCE_LEVELS: {
    VERY_LOW: 1,
    LOW: 2,
    MEDIUM: 3,
    HIGH: 4,
    VERY_HIGH: 5
  },

  // Valid grades (same as before)
  VALID_GRADES: ['10', '11', 'varsity'],

  // Subject focus (Maths-first MVP)
  VALID_SUBJECTS: ['math'],
  SUBJECT_DISPLAY_NAMES: {
    math: 'Mathematics'
  },

  // Math topics (unchanged)
  MATH_TOPICS: {
    calculus: { id: 1, name: 'calculus', display: 'Calculus' },
    trigonometry: { id: 2, name: 'trigonometry', display: 'Trigonometry' },
    algebra: { id: 3, name: 'algebra', display: 'Algebra' },
    geometry: { id: 4, name: 'geometry', display: 'Geometry' },
    statistics: { id: 5, name: 'statistics', display: 'Statistics' },
    functions: { id: 6, name: 'functions', display: 'Functions' }
  },

  // Command types (updated)
  COMMAND_TYPES: {
    STRESSED: 'stressed',
    CONFIDENCE_BOOST: 'confidence_boost',
    PRACTICE: 'practice',
    QUESTION: 'question',
    ANSWER: 'answer',
    HELP: 'help'
  },

  // Menu types (updated)
  MENU_TYPES: {
    WELCOME: 'welcome',
    STRESS_INTAKE: 'stress_intake',
    CONFIDENCE_INTAKE: 'confidence_intake',
    LESSON: 'lesson',
    PRACTICE_ACTIVE: 'practice_active'
  },

  // Limits and constraints
  MAX_RESPONSE_LENGTH: 1200, // WhatsApp optimized
  SESSION_TIMEOUT_MINUTES: 30,

  // Calm emoji set
  CALM_EMOJIS: {
    BRAIN: '🧠',
    GROWTH: '🌱',
    SPARKLES: '✨',
    CHECK: '✅',
    CLOCK: '⏳',
    CALENDAR: '📅',
    HEART_HANDS: '🫶',
    MATH: '🧮'
  },

  // Answer validation
  VALID_ANSWERS: ['A', 'B', 'C', 'D'],

  // Include MESSAGES for backward compatibility
  MESSAGES
};
