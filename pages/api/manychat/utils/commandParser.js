/**
 * Enhanced Command Parser with Fixed Answer Validation and Post-Answer Actions
 * Handles A/B/C/D answers, numbered menus, and various input formats
 */

import { CONSTANTS } from '../config/constants.js';

/**
 * Parse user input and determine command type and action
 * @param {string} message - Raw user input
 * @param {Object} context - User context for parsing decisions
 * @returns {Object} Parsed command with type and action
 */
export function parseCommand(message, context = {}) {
  const input = message.trim();
  const lowerInput = input.toLowerCase();

  console.log(`🎯 Parsing command: "${input}" with context:`, {
    current_menu: context.current_menu,
    expecting_username: context.expecting_username,
    expecting_challenge_username: context.expecting_challenge_username,
    expecting_registration_input: context.expecting_registration_input,
    has_current_question: context.has_current_question
  });

  // PRIORITY 1: ANSWER VALIDATION (A/B/C/D responses)
  if (context.has_current_question || context.expecting_answer) {
    const answerResult = parseAnswerInput(input);
    if (answerResult.isValid) {
      console.log(`✅ Valid answer detected: ${answerResult.letter}`);
      return {
        type: CONSTANTS.COMMAND_TYPES.ANSWER,
        action: 'submit',
        answer: answerResult.letter,
        originalInput: input
      };
    } else if (answerResult.attempted) {
      console.log(`❌ Invalid answer attempt: "${input}"`);
      return {
        type: 'invalid_answer',
        action: 'show_error',
        error: answerResult.error,
        originalInput: input
      };
    }
    // If not an answer attempt, continue with other parsing
  }

  // PRIORITY 2: SPECIAL CONTEXTS (Registration, Username Input)
  if (context.expecting_username) {
    return {
      type: CONSTANTS.COMMAND_TYPES.FRIENDS,
      action: 'add_user',
      target: input
    };
  }

  if (context.expecting_challenge_username) {
    return {
      type: 'challenge',
      action: 'send',
      target: input
    };
  }

  if (context.expecting_registration_input) {
    return {
      type: 'registration',
      action: 'process_input',
      input: input
    };
  }

  // PRIORITY 3: NUMBERED MENU NAVIGATION
  if (context.current_menu) {
    const menuResult = parseMenuInput(input, context.current_menu);
    // A menu input is always considered a valid "action", even if the number is wrong.
    // The 'invalid_option' type is handled by the main switch.
    if (menuResult.isValid) {
        console.log(`📱 Menu command: ${menuResult.command.type} - ${menuResult.command.action || ''}`);
        return menuResult.command;
    }
  }

  // PRIORITY 4: DIRECT COMMANDS
  const directCommand = parseDirectCommands(lowerInput);
  if (directCommand) {
    console.log(`⚡ Direct command: ${directCommand.type}`);
    return directCommand;
  }

  // PRIORITY 5: HOOK COMMANDS
  const hookCommand = parseHookCommands(lowerInput);
  if (hookCommand) {
    console.log(`🎣 Hook command: ${hookCommand.type}`);
    return hookCommand;
  }

  // DEFAULT: Show main menu
  console.log(`🔄 Unknown command, showing main menu`);
  return {
    type: 'main_menu',
    action: 'show',
    originalInput: input
  };
}

/**
 * Parse A/B/C/D answer inputs with flexible format support
 */
function parseAnswerInput(input) {
  const cleanInput = input.trim().toUpperCase();

  const answerPatterns = [
    /^[ABCD]$/, // Just the letter: A, B, C, D
    /^[ABCD]\)$/, // Letter with parenthesis: A), B), C), D)
    /^ANSWER\s*[ABCD]$/, // "ANSWER A", "ANSWER B", etc.
    /^OPTION\s*[ABCD]$/, // "OPTION A", "OPTION B", etc.
    /^[ABCD]\.$/, // Letter with period: A., B., C., D.
    /^\([ABCD]\)$/ // Parentheses around letter: (A), (B), etc.
  ];

  for (const pattern of answerPatterns) {
    const match = cleanInput.match(pattern);
    if (match) {
      const letter = cleanInput.replace(/[^ABCD]/g, '');
      return {
        isValid: true,
        letter: letter,
        attempted: true
      };
    }
  }

  const attemptPatterns = [
    /^[1-9]$/, // Numbers 1-9 (common mistake)
    /^[EFGHIJKLMNOPQRSTUVWXYZ]$/, // Other letters
    /^ANSWER/i, // Starts with "answer" but malformed
    /^OPTION/i // Starts with "option" but malformed
  ];

  const isAttempt = attemptPatterns.some((pattern) => input.match(pattern));

  if (isAttempt) {
    return {
      isValid: false,
      attempted: true,
      error: generateAnswerErrorMessage(input)
    };
  }

  return {
    isValid: false,
    attempted: false
  };
}

/**
 * Generate helpful error message for invalid answer attempts
 */
function generateAnswerErrorMessage(input) {
  const cleanInput = input.trim();

  if (/^[1-9]$/.test(cleanInput)) {
    return `Numbers won't work here! 📝\n\nFor multiple choice questions, send the LETTER:\n• A, B, C, or D\n\nYou sent: "${input}"\nTry: "A" or "B" or "C" or "D" �`;
  }

  if (/^[EFGHIJKLMNOPQRSTUVWXYZ]$/.test(cleanInput.toUpperCase())) {
    return `Only A, B, C, or D work for answers! 📝\n\nYou sent: "${input}"\nChoose: A, B, C, or D 🎯`;
  }

  return `Invalid answer format! 📝\n\nFor multiple choice questions, just send:\n• A, B, C, or D\n\nYou sent: "${input}"\nTry again with A, B, C, or D 🎯`;
}

/**
 * Parse numbered menu inputs
 */
function parseMenuInput(input, currentMenu) {
  const number = parseInt(input.trim());

  if (isNaN(number)) {
    return { isValid: false };
  }

  const menuMappings = {
    main: {
      1: { type: CONSTANTS.COMMAND_TYPES.QUESTION, action: 'next' },
      2: { type: 'subject_menu', action: 'show' },
      3: { type: CONSTANTS.COMMAND_TYPES.REPORT, action: 'show' },
      4: { type: 'friends_menu', action: 'show' },
      5: { type: 'settings_menu', action: 'show' }
    },
    subject: {
      1: { type: CONSTANTS.COMMAND_TYPES.SUBJECT_SWITCH, target: 'math' },
      2: { type: CONSTANTS.COMMAND_TYPES.SUBJECT_SWITCH, target: 'physics' },
      3: { type: CONSTANTS.COMMAND_TYPES.SUBJECT_SWITCH, target: 'life_sciences' },
      4: { type: CONSTANTS.COMMAND_TYPES.SUBJECT_SWITCH, target: 'chemistry' },
      5: { type: 'main_menu', action: 'show' }
    },
    math_topics: {
      1: { type: 'math_topic_select', target: 'algebra', topicNumber: 1 },
      2: { type: 'math_topic_select', target: 'geometry', topicNumber: 2 },
      3: { type: 'math_topic_select', target: 'trigonometry', topicNumber: 3 },
      4: { type: 'math_topic_select', target: 'calculus', topicNumber: 4 },
      5: { type: 'math_topic_select', target: 'statistics', topicNumber: 5 },
      6: { type: 'math_topic_select', target: 'functions', topicNumber: 6 },
      7: { type: 'math_topic_select', target: 'number_theory', topicNumber: 7 },
      8: { type: 'math_topic_select', target: 'random', topicNumber: 8 },
      9: { type: 'subject_menu', action: 'show' }
    },
    friends: {
      1: { type: CONSTANTS.COMMAND_TYPES.FRIENDS, action: 'list' },
      2: { type: CONSTANTS.COMMAND_TYPES.FRIENDS, action: 'add_prompt' },
      3: { type: 'challenge', action: 'prompt' },
      4: { type: 'main_menu', action: 'show' }
    },
    settings: {
      1: { type: 'profile', action: 'show' },
      2: { type: 'notifications', action: 'settings' },
      3: { type: 'main_menu', action: 'show' }
    },
    // *** UPDATED SECTION ***
    'post_answer': {
        1: { type: 'post_answer_action', actionNumber: 1 }, // Next question
        2: { type: 'post_answer_action', actionNumber: 2 }, // Switch topic
        3: { type: 'post_answer_action', actionNumber: 3 }, // Challenge/Review
        4: { type: 'post_answer_action', actionNumber: 4 }, // Progress/Challenge
        5: { type: 'post_answer_action', actionNumber: 5 }  // Menu/Detailed Progress
    }
  };

  const mapping = menuMappings[currentMenu];
  if (mapping && mapping[number]) {
    return {
      isValid: true,
      command: {
        ...mapping[number],
        menuSelection: number,
        fromMenu: currentMenu
      }
    };
  }

  // Invalid menu option
  return {
    isValid: true, // It's a valid *type* of input (a number), just not a valid *option*
    command: {
      type: 'invalid_option',
      menu: currentMenu,
      attempted: number,
      validRange: getValidMenuRange(currentMenu)
    }
  };
}

function getValidMenuRange(menuType) {
  const ranges = {
    main: '1-5',
    subject: '1-5',
    math_topics: '1-9',
    friends: '1-4',
    settings: '1-3',
    post_answer: '1-5'
  };
  return ranges[menuType] || '1-5';
}

/**
 * Parse direct text commands
 */
function parseDirectCommands(lowerInput) {
  const commandMap = {
    next: { type: CONSTANTS.COMMAND_TYPES.QUESTION, action: 'next' },
    menu: { type: 'main_menu', action: 'show' },
    help: { type: CONSTANTS.COMMAND_TYPES.HELP, action: 'show' },
    report: { type: CONSTANTS.COMMAND_TYPES.REPORT, action: 'show' },
    friends: { type: 'friends_menu', action: 'show' },
    settings: { type: 'settings_menu', action: 'show' }
  };

  if (commandMap[lowerInput]) {
    return commandMap[lowerInput];
  }

  if (lowerInput.startsWith('switch to ')) {
    const subject = lowerInput.replace('switch to ', '').trim();
    return {
      type: CONSTANTS.COMMAND_TYPES.SUBJECT_SWITCH,
      target: subject
    };
  }

  return null;
}

/**
 * Parse hook testing commands
 */
function parseHookCommands(lowerInput) {
  if (lowerInput.startsWith('hook ')) {
    const hookType = lowerInput.replace('hook ', '').trim();
    return {
      type: 'manual_hook',
      action: 'trigger',
      target: hookType
    };
  }

  if (lowerInput === 'hook stats') {
    return {
      type: 'hook_stats',
      action: 'show'
    };
  }

  return null;
}

/**
 * Validate if input is a valid answer choice
 */
export function isValidAnswerChoice(input) {
  const result = parseAnswerInput(input);
  return result.isValid;
}

/**
 * Extract letter from answer input
 */
export function extractAnswerLetter(input) {
  const result = parseAnswerInput(input);
  return result.isValid ? result.letter : null;
}

/**
 * Check if input looks like an answer attempt
 */
export function isAnswerAttempt(input) {
  const result = parseAnswerInput(input);
  return result.attempted;
}
