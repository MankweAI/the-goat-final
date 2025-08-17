/**
 * The GOAT Bot - Enhanced MVP Configuration
 * Updated: 2025-08-17 10:50:37 UTC
 * Changes: Added homework feature, removed confidence, simplified exam flow
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
    // New streamlined menu - 3 core options
    MAIN_MENU:
      `Welcome. I'm here to help you study with calm and clarity.\n\n` +
      `What do you need right now?\n\n` +
      `1️⃣ 📅 Exam/Test coming 😰\n` +
      `2️⃣ 📚 I got Homework 🫶\n` +
      `3️⃣ 🧮 I need more practice\n\n` +
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

  // Exam prep support (simplified - no stress level)
  EXAM_PREP: {
    SUBJECT_PROMPT:
      `Let's focus on one subject to start.\n\n` +
      `Which subject needs attention?\n\n` +
      `1️⃣ Mathematics\n` +
      `2️⃣ Physics (Maths ready now)\n` +
      `3️⃣ Chemistry (Maths ready now)\n` +
      `4️⃣ Life Sciences (Maths ready now)`,

    EXAM_DATE_PROMPT:
      `When is your exam/test? (e.g., 22 Aug 7pm)\n\n` + `If you're not sure, say "skip". ⏳`,

    PLAN_OFFER_LONG:
      `I can send a short lesson + practice each day until then.\n\n` +
      `Want that? Type "yes" or "no". 📅`,

    PLAN_OFFER_SHORT:
      `Let's keep it focused: targeted review + practice questions + confidence building.\n\n` +
      `Ready to start? Type "yes"! 🌱`,

    TIME_PROMPT:
      `What time suits you daily? (e.g., 7pm)\n\n` + `I'll send gentle reminders at that time. ⏰`,

    VALIDATION_RESPONSE: `I understand. Let's take this step by step together. 🌱`
  },

  // NEW: Homework support with academic integrity
  HOMEWORK: {
    WELCOME_MESSAGE:
      `📚 HOMEWORK HELPER ACTIVATED!\n\n` +
      `I'll teach you the method so you can tackle your homework confidently.\n\n` +
      `What subject is your homework in?\n\n` +
      `1️⃣ Mathematics\n` +
      `2️⃣ Physics (Maths ready now)\n` +
      `3️⃣ Chemistry (Maths ready now)\n` +
      `4️⃣ Life Sciences (Maths ready now)`,

    PROBLEM_TYPE_PROMPT:
      `What type of math problems are in your homework?\n\n` +
      `1️⃣ Equations (linear, quadratic)\n` +
      `2️⃣ Word problems\n` +
      `3️⃣ Graphs and functions\n` +
      `4️⃣ Calculus (derivatives, integrals)\n` +
      `5️⃣ Trigonometry\n` +
      `6️⃣ Other/Not sure`,

    CONFUSION_PROMPT:
      `Don't send me your actual homework questions!\n\n` +
      `Instead, tell me what part feels confusing:\n` +
      `• Which step gets you stuck?\n` +
      `• What method are you unsure about?\n` +
      `• Where do you lose confidence?\n\n` +
      `The more specific, the better I can help! 🧠`,

    ACADEMIC_INTEGRITY_REMINDER:
      `🎯 REMEMBER: I teach methods, not answers!\n\n` +
      `I'll show you how to approach problems like yours, then you apply the method to your actual homework.\n\n` +
      `Ready to learn the approach?`,

    METHOD_TEACHING_INTRO: `📘 Here's the method with similar examples:\n\n`,

    PRACTICE_ENCOURAGEMENT:
      `🎯 YOUR TURN: Use this method on your homework.\n\n` +
      `Come back if you get stuck on the process (not the specific answer)!\n\n` +
      `Need more practice first? Type "practice"! 💪`
  },

  LESSONS: {
    CALCULUS_INTRO:
      `📘 Calculus (First Principles) – Method Guide\n\n` +
      `• Pattern: f'(x) = lim_{h→0} (f(x+h) − f(x)) / h\n` +
      `• Steps: Expand → Simplify → Factor h → Take limit\n` +
      `• Key: Go step-by-step, don't skip algebra\n\n` +
      `Example method:\n` +
      `For f(x) = x^2:\n` +
      `1) f(x+h) = x^2 + 2xh + h^2\n` +
      `2) f(x+h) − f(x) = 2xh + h^2\n` +
      `3) Divide by h → 2x + h\n` +
      `4) Limit as h→0 → 2x\n\n` +
      `Worked example:\n` +
      `f(x) = 3x^2 follows same pattern → 6x\n\n` +
      `1️⃣ Try practice questions\n` +
      `2️⃣ See another example\n` +
      `3️⃣ Back to homework`,

    TRIGONOMETRY_INTRO:
      `📗 Trigonometry Identity – Method Guide\n\n` +
      `• Core: sin²(x) + cos²(x) = 1\n` +
      `• Strategy: Convert everything to sin and cos\n` +
      `• Tip: Memorize special angles (30°, 45°, 60°)\n\n` +
      `Method for simplifying:\n` +
      `1) Use fundamental identity: sin² + cos² = 1\n` +
      `2) Substitute: 1 − cos²(x) = sin²(x)\n` +
      `3) Simplify fractions\n\n` +
      `Example: (1 − cos²x)/sin x = sin²x / sin x = sin x\n\n` +
      `1️⃣ Try practice questions\n` +
      `2️⃣ See another example\n` +
      `3️⃣ Back to homework`
  },

  FEEDBACK: {
    CORRECT_SIMPLE: `Excellent! You're building solid understanding. ✅`,
    INCORRECT_SIMPLE: `Not quite, but you're learning. That's how mastery builds. 🌱`,
    BREATHING_CUE: `Take a breath. You've got this. 🫶`
  },

  PRACTICE: {
    START_PROMPT: `Let's practice the method with some questions. 🧮`,
    CONTINUE_MENU:
      `What's next?\n\n` +
      `1️⃣ Continue practicing\n` +
      `2️⃣ Switch topic\n` +
      `3️⃣ Back to homework\n` +
      `4️⃣ Take a break\n\n` +
      `Pick a number! ✨`
  }
};

export const CONSTANTS = {
  // Valid grades (unchanged)
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

  // Updated command types (removed confidence, added homework)
  COMMAND_TYPES: {
    EXAM_PREP: 'exam_prep',
    HOMEWORK: 'homework',
    PRACTICE: 'practice',
    QUESTION: 'question',
    ANSWER: 'answer',
    HELP: 'help'
  },

  // Updated menu types
  MENU_TYPES: {
    WELCOME: 'welcome',
    EXAM_PREP: 'exam_prep',
    HOMEWORK: 'homework',
    LESSON: 'lesson',
    PRACTICE_ACTIVE: 'practice_active'
  },

  // Homework-specific constants
  HOMEWORK_TYPES: {
    EQUATIONS: 'equations',
    WORD_PROBLEMS: 'word_problems',
    GRAPHS: 'graphs_functions',
    CALCULUS: 'calculus',
    TRIGONOMETRY: 'trigonometry',
    OTHER: 'other'
  },

  // Academic integrity safeguards
  ACADEMIC_INTEGRITY: {
    NO_DIRECT_ANSWERS: 'I teach methods, not answers',
    NO_HOMEWORK_SOLVING: "Don't send your homework questions",
    ENCOURAGE_LEARNING: 'Learn the method, then apply it yourself',
    TRANSPARENCY: 'I help you understand, not complete assignments'
  },

  // Limits and constraints
  MAX_RESPONSE_LENGTH: 1200,
  SESSION_TIMEOUT_MINUTES: 30,

  // Emojis
  EMOJIS: {
    BRAIN: '🧠',
    GROWTH: '🌱',
    SPARKLES: '✨',
    CHECK: '✅',
    CALENDAR: '📅',
    HOMEWORK: '📚',
    HEART_HANDS: '🫶',
    MATH: '🧮'
  },

  // Answer validation
  VALID_ANSWERS: ['A', 'B', 'C', 'D'],

  // Include MESSAGES for backward compatibility
  MESSAGES
};
