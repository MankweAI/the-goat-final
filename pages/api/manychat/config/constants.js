export const CONSTANTS = {
  // User registration states
  REGISTRATION_STATES: {
    NEEDS_USERNAME: 'needs_username',
    NEEDS_GRADE: 'needs_grade',
    NEEDS_SUBJECTS: 'needs_subjects',
    COMPLETE: 'complete'
  },

  // Difficulty levels
  DIFFICULTY: {
    EASY: 'easy',
    MEDIUM: 'medium',
    HARD: 'hard'
  },

  // Grade levels
  VALID_GRADES: ['8', '9', '10', '11', '12', 'varsity'],

  // Subjects
  VALID_SUBJECTS: ['math', 'physics', 'life_sciences', 'chemistry'],
  SUBJECT_DISPLAY_NAMES: {
    math: 'Mathematics',
    physics: 'Physics',
    life_sciences: 'Life Sciences',
    chemistry: 'Chemistry'
  },

  // Command types
  COMMAND_TYPES: {
    QUESTION: 'question',
    ANSWER: 'answer',
    REPORT: 'report',
    FRIENDS: 'friends',
    CHALLENGE: 'challenge',
    SUBJECT_SWITCH: 'subject_switch',
    HELP: 'help'
  },

  // Response limits
  MAX_RESPONSE_LENGTH: 4000,
  SESSION_TIMEOUT_MINUTES: 60,

  // Social features
  MAX_FRIENDS: 50,
  CHALLENGE_EXPIRY_HOURS: 24,
  FRIEND_CODE_LENGTH: 8,

  // Streak thresholds
  STREAK_LEVELS: {
    FIRE: 3,
    DOUBLE_FIRE: 5,
    TRIPLE_FIRE: 10
  }
};

export const MESSAGES = {
  ERRORS: {
    GENERIC: 'Eish, something glitched on my side. Give it a sec then try again. 🙏',
    DATABASE: 'Database hiccup! Try again in a moment. 💪',
    VALIDATION: "That doesn't look right. Check your input and try again! ✨"
  },

  REGISTRATION: {
    WELCOME:
      "Howzit! Welcome to The GOAT! 🐐\n\nI'm here to help you dominate your studies with unlimited practice questions!\n\nLet's get you set up. What should I call you? (This will be your display name)",

    USERNAME_PROMPT:
      'Sharp! Now pick a unique username for challenges and friends (like @your_name123):\n\n• 3-20 characters\n• Letters, numbers, underscore only\n• This is how friends will find you!',

    GRADE_PROMPT: 'Perfect! What grade are you in?\n\nJust type: 8, 9, 10, 11, 12, or varsity 📚',

    SUBJECTS_PROMPT:
      'Lekker! Which subjects do you want to dominate?\n\nType them like: math, physics, life sciences\n\nAvailable subjects:\n🧮 math\n⚡ physics\n🧬 life sciences\n⚗️ chemistry\n\n(You can always switch topics later!)'
  }
};

