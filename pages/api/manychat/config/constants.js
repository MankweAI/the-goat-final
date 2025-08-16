/**
 * The GOAT Bot - Pivoted Constants Configuration
 * Updated: 2025-08-16 15:38:16 UTC
 * Pivot: Maths-only MVP + Panic/Therapy flows, simplified registration
 *
 * Notes:
 * - MESSAGES is included inside CONSTANTS (to satisfy callers using CONSTANTS.MESSAGES)
 *   and also exported separately for direct imports elsewhere.
 */

// Pivoted messaging (kept first so CONSTANTS can include it)
export const MESSAGES = {
  ERRORS: {
    GENERIC: 'Eish, something glitched on my side. Give it a sec then try again. 🙏',
    DATABASE: 'Database hiccup! Try again in a moment. 💪',
    VALIDATION: "That doesn't look right. Check your input and try again! ✨",
    INVALID_ANSWER:
      'Invalid answer format! 📝\n\nFor multiple choice questions, just send:\n• A, B, C, or D\n\nTry again! 🎯',
    INVALID_MENU_OPTION: 'Invalid menu choice! Pick a valid number from the options above! 🎯',
    NO_QUESTION_ACTIVE: 'No question to answer! Type "next" to get a fresh question! 🎯',
    QUESTION_EXPIRED: 'That question expired! Type "next" for a fresh one! 🔄'
  },

  REGISTRATION: {
    // Pivoted welcome to emphasize Panic/Therapy and Maths-only MVP
    WELCOME:
      `🎉 WELCOME TO THE GOAT! 🐐\n\n` +
      `Your Maths confidence companion.\n\n` +
      `🔥 What we do:\n` +
      `• 🚨 Panic Mode: quick wins when stress hits\n` +
      `• 🧠 Therapy Mode: boost academic confidence\n` +
      `• 🎯 Practice: sharp, level-matched maths questions\n\n` +
      `Let's get you set up! First, what should I call you?\n\n` +
      `💡 Examples: Alex, Sarah, Thabo\n\n` +
      `Type your name to continue! ✨`,

    USERNAME_PROMPT:
      `Sharp! Now pick a unique username for friends and challenges:\n\n` +
      `📝 Requirements:\n` +
      `• 3-20 characters\n` +
      `• Letters, numbers, underscore only\n\n` +
      `💡 Examples: alex123, sarah_w, thabo_math\n\n` +
      `What username do you want? 🎯`,

    GRADE_PROMPT:
      `Perfect! What grade are you in?\n\n` +
      `📚 Options:\n` +
      `• 10, 11\n` +
      `• varsity (for university)\n\n` +
      `Just type your grade! 🎓`,

    // Kept for backward compatibility (not used after pivot)
    SUBJECTS_PROMPT: `This platform is Maths-only for now. Type "next" to start or "panic"/"therapy" anytime. 💪`
  },

  MENUS: {
    MAIN:
      `🏠 THE GOAT - MAIN MENU\n\n` +
      `Welcome back! What do you want to do?\n\n` +
      `1️⃣ 🎯 Get practice question\n` +
      `2️⃣ 📚 Choose subjects\n` + // kept for compatibility; subject menu still exists
      `3️⃣ 📊 Progress report\n` +
      `4️⃣ 👥 Friends & challenges\n` +
      `5️⃣ ⚙️ Settings\n\n` +
      `Tip: You can type "panic" or "therapy" anytime.`,

    SUBJECTS:
      `📚 CHOOSE YOUR SUBJECT\n\n` +
      `For now, The GOAT is Maths-first.\n\n` +
      `1️⃣ 🧮 Mathematics\n` +
      `2️⃣ ⚡ Physics (coming later)\n` +
      `3️⃣ 🧬 Life Sciences (later)\n` +
      `4️⃣ ⚗️ Chemistry (later)\n\n` +
      `5️⃣ 🏠 Back to main menu\n\n` +
      `Type the number! 🎯`,

    MATH_TOPICS:
      `🧮 MATHEMATICS — Choose your battlefield!\n\n` +
      `1️⃣ Algebra — Equations, functions, graphs\n` +
      `2️⃣ Geometry — Shapes, angles, proofs\n` +
      `3️⃣ Trigonometry — Sin, cos, tan ratios\n` +
      `4️⃣ Calculus — Derivatives, integrals\n` +
      `5️⃣ Statistics — Data, probability, graphs\n` +
      `6️⃣ Functions — Domain, range, transformations\n` +
      `7️⃣ Number Theory — Patterns, sequences, series\n` +
      `8️⃣ Surprise me! — Random math mix\n\n` +
      `9️⃣ Back to subjects\n\n` +
      `Just type the number! 🔥`,

    FRIENDS:
      `👥 FRIENDS & CHALLENGES\n\n` +
      `Connect with friends and compete!\n\n` +
      `1️⃣ 👥 My friends list\n` +
      `2️⃣ ➕ Add friend by username\n` +
      `3️⃣ ⚔️ Challenge a friend\n` +
      `4️⃣ 🏠 Back to main menu\n\n` +
      `Type the number! 🤝`,

    SETTINGS:
      `⚙️ SETTINGS\n\n` +
      `Customize your experience:\n\n` +
      `1️⃣ 👤 Profile settings\n` +
      `2️⃣ 🔔 Notification preferences\n` +
      `3️⃣ 🏠 Back to main menu\n\n` +
      `Type the number! ⚡`
  },

  FRIENDS: {
    ADD_PROMPT:
      `👥 ADD A FRIEND\n\n` +
      `Type your friend's username (without @):\n\n` +
      `💡 Example: sarah123\n\n` +
      `What's their username? 🤝`,

    CHALLENGE_PROMPT:
      `⚔️ CHALLENGE A FRIEND\n\n` +
      `Who do you want to battle?\n\n` +
      `🎯 Type their username (like: john123)\n` +
      `💡 Or type 'random' for a mystery opponent\n\n` +
      `The question you just answered will be their challenge!\n` +
      `Winner gets bragging rights! 🏆`
  },

  ANSWER_FEEDBACK: {
    CORRECT_STREAKS: {
      1: 'Nice one! 🔥',
      3: 'On fire! 🔥🔥',
      5: 'Absolutely crushing it! 🔥🔥⚡',
      10: 'LEGENDARY streak! 🔥🔥🔥',
      15: 'UNSTOPPABLE! 🔥🔥🔥🏆'
    },
    INCORRECT_ENCOURAGEMENT: [
      'Eish, not this time! Keep pushing! 💪',
      'Close one! Try again! 🎯',
      'No stress! Learn and come back stronger! 📚',
      "Every mistake is progress! Let's go! 🚀"
    ]
  },

  INSTRUCTIONS: [
    'Just send the letter (A, B, C or D). Sharp? 🔥',
    'Type your answer: A, B, C or D! 🎯',
    'Pick your choice: A, B, C or D! ⚡',
    'Send the letter of your answer! 🚀',
    "Choose A, B, C or D! Let's go! 💪",
    'Answer with A, B, C or D! 🔥',
    'Type A, B, C or D to answer! 🎯',
    'Send your choice (A, B, C or D)! ⚡'
  ]
};

export const CONSTANTS = {
  // Registration states (pivot: no subjects step)
  REGISTRATION_STATES: {
    NEEDS_USERNAME: 'needs_username',
    NEEDS_GRADE: 'needs_grade',
    COMPLETE: 'complete'
  },

  // Difficulty levels
  DIFFICULTY: {
    EASY: 'easy',
    MEDIUM: 'medium',
    HARD: 'hard',
    EXPERT: 'expert'
  },

  // Pivot: support Grades 10/11 + varsity (aligns with validators.js)
  VALID_GRADES: ['10', '11', 'varsity'],

  // Pivot: Maths-only MVP (other subjects kept elsewhere for future)
  VALID_SUBJECTS: ['math'],
  SUBJECT_DISPLAY_NAMES: {
    math: 'Mathematics'
  },

  // Math topics configuration
  MATH_TOPICS: {
    algebra: { id: 1, name: 'algebra', display: 'Algebra', description: 'equations and functions' },
    geometry: { id: 2, name: 'geometry', display: 'Geometry', description: 'shapes and angles' },
    trigonometry: {
      id: 3,
      name: 'trigonometry',
      display: 'Trigonometry',
      description: 'trig ratios'
    },
    calculus: {
      id: 4,
      name: 'calculus',
      display: 'Calculus',
      description: 'derivatives and integrals'
    },
    statistics: {
      id: 5,
      name: 'statistics',
      display: 'Statistics',
      description: 'data and probability'
    },
    functions: { id: 6, name: 'functions', display: 'Functions', description: 'function analysis' },
    number_theory: {
      id: 7,
      name: 'number_theory',
      display: 'Number Theory',
      description: 'patterns and sequences'
    },
    random: { id: 8, name: 'random', display: 'Random Math', description: 'mixed topics' }
  },

  // Extended command types
  COMMAND_TYPES: {
    QUESTION: 'question',
    ANSWER: 'answer',
    REPORT: 'report',
    FRIENDS: 'friends',
    CHALLENGE: 'challenge',
    SUBJECT_SWITCH: 'subject_switch',
    HELP: 'help',
    MATH_TOPIC_SELECT: 'math_topic_select',
    POST_ANSWER_ACTION: 'post_answer_action',
    INVALID_ANSWER: 'invalid_answer'
  },

  // Limits
  MAX_RESPONSE_LENGTH: 4000,
  SESSION_TIMEOUT_MINUTES: 60,

  // Social
  MAX_FRIENDS: 50,
  CHALLENGE_EXPIRY_HOURS: 24,
  FRIEND_CODE_LENGTH: 8,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 20,

  // Streak thresholds
  STREAK_LEVELS: {
    SPARK: 1,
    FIRE: 3,
    DOUBLE_FIRE: 5,
    TRIPLE_FIRE: 10,
    LEGENDARY: 15,
    GOAT_MODE: 20
  },

  // Menu types (includes panic/therapy)
  MENU_TYPES: {
    MAIN: 'main',
    SUBJECT: 'subject',
    MATH_TOPICS: 'math_topics',
    FRIENDS: 'friends',
    SETTINGS: 'settings',
    POST_ANSWER: 'post_answer',
    QUESTION_ACTIVE: 'question_active',
    PANIC: 'panic',
    THERAPY: 'therapy'
  },

  // Answer validation patterns
  ANSWER_PATTERNS: {
    VALID_LETTERS: ['A', 'B', 'C', 'D'],
    VALID_FORMATS: [
      /^[ABCD]$/,
      /^[ABCD]\)$/,
      /^ANSWER\s*[ABCD]$/,
      /^OPTION\s*[ABCD]$/,
      /^[ABCD]\.$/,
      /^\([ABCD]\)$/
    ]
  },

  // Main menu options (labels only; logic handled elsewhere)
  MAIN_MENU_OPTIONS: {
    1: { type: 'question', action: 'next', description: 'Get Practice Question', emoji: '🎯' },
    2: { type: 'subject_menu', action: 'show', description: 'Choose Subjects', emoji: '📚' },
    3: { type: 'report', action: 'show', description: 'Progress Report', emoji: '📊' },
    4: { type: 'friends_menu', action: 'show', description: 'Friends & Challenges', emoji: '👥' },
    5: { type: 'settings_menu', action: 'show', description: 'Settings', emoji: '⚙️' }
  },

  // Subject menu options (kept for compatibility; non-math are future)
  SUBJECT_MENU_OPTIONS: {
    1: { subject: 'math', name: 'Mathematics', emoji: '🧮', hasSubTopics: true },
    2: { subject: 'physics', name: 'Physics', emoji: '⚡', hasSubTopics: false },
    3: { subject: 'life_sciences', name: 'Life Sciences', emoji: '🧬', hasSubTopics: false },
    4: { subject: 'chemistry', name: 'Chemistry', emoji: '⚗️', hasSubTopics: false },
    5: { type: 'main_menu', action: 'show', name: 'Back to Main Menu', emoji: '🏠' }
  },

  // Math topics menu options
  MATH_TOPICS_MENU_OPTIONS: {
    1: { topic: 'algebra', name: 'Algebra', description: 'equations, functions, graphs' },
    2: { topic: 'geometry', name: 'Geometry', description: 'shapes, angles, proofs' },
    3: { topic: 'trigonometry', name: 'Trigonometry', description: 'sin, cos, tan ratios' },
    4: { topic: 'calculus', name: 'Calculus', description: 'derivatives, integrals' },
    5: { topic: 'statistics', name: 'Statistics', description: 'data, probability, graphs' },
    6: { topic: 'functions', name: 'Functions', description: 'domain, range, transformations' },
    7: {
      topic: 'number_theory',
      name: 'Number Theory',
      description: 'patterns, sequences, series'
    },
    8: { topic: 'random', name: 'Surprise me!', description: 'random math topic mix' },
    9: { type: 'subject_menu', action: 'show', name: 'Back to subjects' }
  },

  // Friends menu options
  FRIENDS_MENU_OPTIONS: {
    1: { type: 'friends', action: 'list', name: 'My Friends List', emoji: '👥' },
    2: { type: 'friends', action: 'add_prompt', name: 'Add Friend by Username', emoji: '➕' },
    3: { type: 'challenge', action: 'prompt', name: 'Challenge a Friend', emoji: '⚔️' },
    4: { type: 'main_menu', action: 'show', name: 'Back to Main Menu', emoji: '🏠' }
  },

  // Settings menu options
  SETTINGS_MENU_OPTIONS: {
    1: { type: 'profile', action: 'show', name: 'Profile Settings', emoji: '👤' },
    2: { type: 'notifications', action: 'settings', name: 'Notifications', emoji: '🔔' },
    3: { type: 'main_menu', action: 'show', name: 'Back to Main Menu', emoji: '🏠' }
  },

  // Post-answer options (labels)
  POST_ANSWER_OPTIONS: {
    CORRECT_DEFAULT: {
      1: { action: 'next_question', name: 'Next question', context: 'same_topic' },
      2: { action: 'switch_topic', name: 'Switch topic', context: 'subject_menu' },
      3: { action: 'challenge_friend', name: 'Challenge a friend', context: 'challenge' },
      4: { action: 'progress_report', name: 'See progress', context: 'report' },
      5: { action: 'main_menu', name: 'Main menu', context: 'main' }
    },
    CORRECT_STREAK: {
      1: { action: 'next_question', name: 'Keep the streak alive!', context: 'same_topic' },
      2: {
        action: 'challenge_friend',
        name: 'Challenge friend to beat streak',
        context: 'challenge'
      },
      3: { action: 'harder_question', name: 'Try harder question', context: 'difficulty_up' },
      4: { action: 'switch_topic', name: 'Switch topic', context: 'subject_menu' },
      5: { action: 'detailed_progress', name: 'Detailed progress', context: 'detailed_report' }
    },
    INCORRECT_DEFAULT: {
      1: { action: 'next_question', name: 'Try another question', context: 'same_topic' },
      2: { action: 'switch_topic', name: 'Switch topic', context: 'subject_menu' },
      3: { action: 'review_concepts', name: 'Review concepts', context: 'study_tips' },
      4: { action: 'challenge_friend', name: 'Challenge friend', context: 'challenge' },
      5: { action: 'progress_report', name: 'See progress', context: 'report' }
    }
  },

  // Menu navigation ranges
  MENU_RANGES: {
    main: '1-5',
    subject: '1-5',
    math_topics: '1-9',
    friends: '1-4',
    settings: '1-3',
    post_answer: '1-5',
    panic: '1-5',
    therapy: '1-5'
  },

  // Topic emojis
  TOPIC_EMOJIS: {
    algebra: '🔢',
    geometry: '📐',
    trigonometry: '📊',
    calculus: '📈',
    statistics: '📊',
    functions: '📉',
    number_theory: '🔢',
    physics: '⚡',
    mechanics: '⚙️',
    waves: '🌊',
    electricity: '⚡',
    chemistry: '⚗️',
    life_sciences: '🧬',
    english: '📖',
    geography: '🌍',
    history: '📜'
  },

  // Difficulty indicators
  DIFFICULTY_INDICATORS: {
    easy: '🟢 Easy',
    medium: '🟡 Medium',
    hard: '🔴 Hard',
    expert: '🟣 Expert'
  },

  // Streak emojis
  STREAK_EMOJIS: {
    1: '⭐',
    3: '🔥',
    5: '🔥🔥',
    10: '🔥🔥⚡',
    15: '🔥🔥🔥',
    20: '🔥🔥🔥🏆'
  },

  // Panic/Therapy stubs
  PANIC: {
    PANIC_ONLY_MATH: 'For now, Panic Mode is Maths-only. Physics/Chem coming soon. 💪'
  },
  THERAPY: {
    MICRO_SUPPORT_REMINDER: 'Short, sharp, and kind. Keep it under 30 words.'
  },

  // Include MESSAGES on CONSTANTS for callers that reference CONSTANTS.MESSAGES
  MESSAGES
};
