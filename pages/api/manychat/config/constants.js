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
  },
  
  // Menu system
  MENU_TYPES: {
    MAIN: 'main_menu',
    SUBJECTS: 'subject_menu', 
    FRIENDS: 'friends_menu',
    SETTINGS: 'settings_menu'
  },

  // Remove friend codes - use usernames
  SOCIAL_FEATURES: {
    MAX_FRIENDS: 50,
    CHALLENGE_EXPIRY_HOURS: 24,
    USERNAME_MIN_LENGTH: 3,
    USERNAME_MAX_LENGTH: 20
  },

  // Menu responses
  MAIN_MENU_OPTIONS: {
    1: { type: 'question', action: 'next', description: 'Get Practice Question' },
    2: { type: 'subject_menu', action: 'show', description: 'Switch Subject' },
    3: { type: 'report', action: 'show', description: 'My Progress Report' },
    4: { type: 'friends_menu', action: 'show', description: 'Friends & Social' },
    5: { type: 'help', action: 'show', description: 'Help & Commands' },
    6: { type: 'settings', action: 'show', description: 'Settings' }
  },

  SUBJECT_MENU_OPTIONS: {
    1: { subject: 'math', name: 'Mathematics 🧮' },
    2: { subject: 'physics', name: 'Physics ⚡' },
    3: { subject: 'life_sciences', name: 'Life Sciences 🧬' },
    4: { subject: 'chemistry', name: 'Chemistry ⚗️' },
    5: { type: 'main_menu', action: 'show', name: 'Back to Main Menu' }
  },

  FRIENDS_MENU_OPTIONS: {
    1: { type: 'friends', action: 'list', name: 'My Friends List' },
    2: { type: 'friends', action: 'add_prompt', name: 'Add Friend by Username' },
    3: { type: 'challenge', action: 'prompt', name: 'Challenge a Friend' },
    4: { type: 'social_stats', action: 'show', name: 'My Social Stats' },
    5: { type: 'main_menu', action: 'show', name: 'Back to Main Menu' }
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
    },
  MENUS: {
    MAIN: `🎯 THE GOAT - MAIN MENU

1️⃣ Get Practice Question
2️⃣ Switch Subject  
3️⃣ My Progress Report
4️⃣ Friends & Social
5️⃣ Help & Commands
6️⃣ Settings

Type a number (1-6) to continue! 🔥`,

    SUBJECTS: `📚 CHOOSE YOUR SUBJECT

1️⃣ Mathematics 🧮
2️⃣ Physics ⚡  
3️⃣ Life Sciences 🧬
4️⃣ Chemistry ⚗️
5️⃣ Back to Main Menu

Type a number (1-5)! Sharp? 💪`,

    FRIENDS: `👥 FRIENDS & SOCIAL

1️⃣ My Friends List
2️⃣ Add Friend by Username
3️⃣ Challenge a Friend
4️⃣ My Social Stats
5️⃣ Back to Main Menu

Type a number (1-5)! 🤝`,

    SETTINGS: `⚙️ SETTINGS

1️⃣ Change Display Name
2️⃣ Update Subjects
3️⃣ Notification Preferences
4️⃣ Account Info
5️⃣ Back to Main Menu

Type a number (1-5)! ⚡`
  },

  FRIENDS: {
    ADD_PROMPT: `👥 ADD FRIEND

Type your friend's username (without @):

Example: sarah123

What's their username? 🤝`,

    CHALLENGE_PROMPT: `⚔️ CHALLENGE A FRIEND

Type your friend's username:

Example: mike456

Who do you want to challenge? 🔥`
  }
  
};

