/**
 * The GOAT Bot - Enhanced MVP Configuration
 * Updated: 2025-08-17 15:36:12 UTC
 * CRITICAL FIXES:
 * - Removed hardcoded "Back to homework" labels from lessons
 * - Added context-aware menu support
 * - Enhanced exam prep messaging
 * - ADDED MISSING HOMEWORK.WELCOME_MESSAGE
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

  // Homework support messaging
  HOMEWORK: {
    // CRITICAL FIX: Added missing WELCOME_MESSAGE
    WELCOME_MESSAGE:
      `I'm here to help you with your Maths homework! 📚\n\n` +
      `I can teach you methods and approaches (not give you answers).\n\n` +
      `Ready to work together? Type "yes" to continue! 💪`,

    SUBJECT_PROMPT:
      `Which subject needs help?\n\n` +
      `1️⃣ Mathematics\n` +
      `2️⃣ Physics (Maths ready now)\n` +
      `3️⃣ Chemistry (Maths ready now)\n` +
      `4️⃣ Life Sciences (Maths ready now)`,

    PROBLEM_TYPE_PROMPT:
      `What type of problems are you working on?\n\n` +
      `1️⃣ Equations (linear, quadratic)\n` +
      `2️⃣ Word Problems\n` +
      `3️⃣ Graphs & Functions\n` +
      `4️⃣ Calculus (derivatives, integrals)\n` +
      `5️⃣ Trigonometry\n` +
      `6️⃣ Mixed/Other\n\n` +
      `Pick a number! 📘`,

    CONFUSION_PROMPT:
      `Tell me what's confusing you.\n\n` +
      `For example:\n` +
      `• "I don't get how to solve quadratic equations"\n` +
      `• "Word problems are hard to set up"\n` +
      `• "I keep making calculation errors"\n\n` +
      `What's your challenge? 🤔`,

    ACADEMIC_INTEGRITY_REMINDER:
      `🎯 **Academic Integrity Note:**\n` +
      `I'll teach you methods and approaches, not give direct answers. This helps you truly understand and succeed on your own! 📚`,

    PRACTICE_ENCOURAGEMENT: `You're building strong problem-solving skills! Keep practicing these methods on your homework. 💪`,

    VALIDATION_RESPONSE: `I hear you. Let's work through this together step by step. 🌱`
  },

  // Practice messaging
  PRACTICE: {
    CONTINUE_MENU:
      `What would you like to do next?\n\n` +
      `1️⃣ Continue practicing\n` +
      `2️⃣ Switch topic\n` +
      `3️⃣ Take a short break`,

    TOPIC_SWITCH_SUCCESS: `Topic switched! Here's your next question: 🔄`,

    BREAK_MESSAGE:
      `Take your time. Breathe.\n\n` +
      `You're building knowledge step by step. 🌱\n\n` +
      `Type "practice" when ready to continue.`
    },
  
  CONVERSATION_START:
  `Let's prepare for your upcoming test! To create the best study plan for you, could you tell me:

1. What grade you're in
2. Which subject the test is for
3. Any specific topics you're struggling with
4. When the test is happening

Just chat normally - I'll figure out the details! 😊`,

CONVERSATION_FALLBACK:
  `I'm having a bit of trouble understanding. Could you please tell me:
  
• What grade you're in (10, 11, or varsity)
• Which subject your test is for
• When your test is happening
  
This will help me create the right study plan for you! 📚`
};

export const CONSTANTS = {
  // Command types
  COMMAND_TYPES: {
    ANSWER: 'answer',
    EXAM_PREP: 'exam_prep',
    HOMEWORK: 'homework',
    PRACTICE: 'practice'
  },

  // Valid grades for the system
  VALID_GRADES: ['10', '11', 'varsity'],

  // Lesson content (without hardcoded menus)
  LESSONS: {
    CALCULUS_INTRO: {
      title: 'Calculus Introduction',
      content: `Let's break down derivatives step by step.\n\nA derivative measures how fast something changes.\n\nThink of it like the speedometer in a car - it tells you how fast your position is changing at any moment.\n\n📊 Key concept: Rate of change\n🚗 Real example: Speed is the derivative of distance`,
      topic: 'calculus'
    },

    TRIGONOMETRY_INTRO: {
      title: 'Trigonometry Basics',
      content: `Trigonometry is about triangles and circles.\n\nSOH-CAH-TOA is your best friend:\n\n📐 Sin = Opposite/Hypotenuse\n📐 Cos = Adjacent/Hypotenuse\n📐 Tan = Opposite/Adjacent\n\nRemember: Some Old Hippie Caught Another Hippie Tripping On Acid! 😄`,
      topic: 'trigonometry'
    },

    ALGEBRA_INTRO: {
      title: 'Algebra Fundamentals',
      content: `Algebra is like solving puzzles with letters.\n\nThe golden rule: Whatever you do to one side, do to the other.\n\n⚖️ Keep the equation balanced\n🎯 Isolate the variable\n✅ Check your answer by substituting back`,
      topic: 'algebra'
    }
  },

  // Example content (without menus)
  EXAMPLES: {
    CALCULUS_EXTRA: `🧮 Extra derivative example:\n\nFind d/dx of x³ + 2x:\n\n1️⃣ Use power rule: bring down exponent, reduce by 1\n2️⃣ d/dx(x³) = 3x²\n3️⃣ d/dx(2x) = 2\n4️⃣ Answer: 3x² + 2\n\n💡 Power rule: d/dx(xⁿ) = n·xⁿ⁻¹`,

    TRIGONOMETRY_EXTRA: `📐 Extra trig example:\n\nFind sin(30°):\n\n1️⃣ Draw 30-60-90 triangle\n2️⃣ Sides are in ratio 1:√3:2\n3️⃣ sin(30°) = opposite/hypotenuse = 1/2\n4️⃣ Answer: 1/2 = 0.5\n\n💡 Special angles: 30°, 45°, 60° - memorize these!`,

    ALGEBRA_EXTRA: `🎯 Extra algebra example:\n\nSolve: 2x + 5 = 13\n\n1️⃣ Subtract 5 from both sides: 2x = 8\n2️⃣ Divide both sides by 2: x = 4\n3️⃣ Check: 2(4) + 5 = 8 + 5 = 13 ✅\n\n💡 Always check your answer!`
  },

  // Topic configurations
  TOPICS: {
    CALCULUS: {
      display_name: 'Calculus',
      difficulty_levels: ['basic', 'intermediate', 'advanced'],
      lesson_key: 'CALCULUS_INTRO',
      example_key: 'CALCULUS_EXTRA'
    },
    TRIGONOMETRY: {
      display_name: 'Trigonometry',
      difficulty_levels: ['basic', 'intermediate', 'advanced'],
      lesson_key: 'TRIGONOMETRY_INTRO',
      example_key: 'TRIGONOMETRY_EXTRA'
    },
    ALGEBRA: {
      display_name: 'Algebra',
      difficulty_levels: ['basic', 'intermediate', 'advanced'],
      lesson_key: 'ALGEBRA_INTRO',
      example_key: 'ALGEBRA_EXTRA'
    }
  },

  // Menu contexts for proper labeling
  MENU_CONTEXTS: {
    EXAM_PREP: 'exam',
    HOMEWORK: 'homework',
    PRACTICE: 'practice',
    GENERAL: 'general'
  }
};

// Default exports
export default { MESSAGES, CONSTANTS };
