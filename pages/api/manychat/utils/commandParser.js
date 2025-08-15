/**
 * Enhanced Command Parser with Corrected Menu Logic
 * Handles A/B/C/D answers, numbered menus, global commands, and various input formats.
 */

import { CONSTANTS } from '../config/constants.js';

/**
 * Parse user input and determine command type and action.
 * @param {string} message - Raw user input.
 * @param {Object} context - User context for parsing decisions.
 * @returns {Object} Parsed command with type and action.
 */
export function parseCommand(message, context = {}) {
  const input = message.trim();
  const lowerInput = input.toLowerCase();

  console.log(`🎯 Parsing command: "${input}" with context:`, context);

  // PRIORITY 1: Check for an answer to an active question.
  if (context.expecting_answer || context.has_current_question) {
    const answerResult = parseAnswerInput(input);
    if (answerResult.isValid) {
      console.log(`✅ Valid answer detected: ${answerResult.letter}`);
      return {
        type: CONSTANTS.COMMAND_TYPES.ANSWER,
        action: 'submit',
        answer: answerResult.letter
      };
    }
    if (answerResult.attempted) {
      console.log(`❌ Invalid answer attempt: "${input}"`);
      return { type: 'invalid_answer', error: answerResult.error };
    }
  }

  // PRIORITY 2: Check for numbered menu navigation if the user is in a menu.
  if (context.current_menu) {
    const menuResult = parseMenuInput(input, context.current_menu);
    // This check is crucial. If it's a valid menu command, we return it immediately.
    if (menuResult.isValid) {
      console.log(`📱 Menu command parsed: ${menuResult.command.type}`);
      return menuResult.command;
    }
  }

  // PRIORITY 3: Check for global text commands (like "menu", "next", "report").
  const directCommand = parseDirectCommands(lowerInput);
  if (directCommand) {
    console.log(`⚡ Direct command parsed: ${directCommand.type}`);
    return directCommand;
  }

  // PRIORITY 4: Check for special context inputs (e.g., typing a friend's username).
  if (context.expecting_username) {
    return { type: CONSTANTS.COMMAND_TYPES.FRIENDS, action: 'add_user', target: input };
  }
  if (context.expecting_registration_input) {
    return { type: 'registration', action: 'process_input', input: input };
  }

  // DEFAULT: If no other command is matched, show the main menu.
  console.log(`🔄 Unknown command, defaulting to main menu.`);
  return { type: 'main_menu', action: 'show', originalInput: input };
}

/**
 * Parses numbered menu inputs based on the user's current menu context.
 */
function parseMenuInput(input, currentMenu) {
  const number = parseInt(input.trim(), 10);
  if (isNaN(number)) {
    return { isValid: false }; // Not a number, so not a menu command.
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
      1: { type: 'math_topic_select', topicNumber: 1 },
      2: { type: 'math_topic_select', topicNumber: 2 },
      3: { type: 'math_topic_select', topicNumber: 3 },
      4: { type: 'math_topic_select', topicNumber: 4 },
      5: { type: 'math_topic_select', topicNumber: 5 },
      6: { type: 'math_topic_select', topicNumber: 6 },
      7: { type: 'math_topic_select', topicNumber: 7 },
      8: { type: 'math_topic_select', topicNumber: 8 },
      9: { type: 'subject_menu', action: 'show' }
    },
    post_answer: {
      1: { type: 'post_answer_action', actionNumber: 1 },
      2: { type: 'post_answer_action', actionNumber: 2 },
      3: { type: 'post_answer_action', actionNumber: 3 },
      4: { type: 'post_answer_action', actionNumber: 4 },
      5: { type: 'post_answer_action', actionNumber: 5 }
    }
  };

  const mapping = menuMappings[currentMenu];
  if (mapping && mapping[number]) {
    return {
      isValid: true,
      command: { ...mapping[number], menuSelection: number }
    };
  }

  // The number was outside the valid range for this menu.
  return {
    isValid: true, // It's still a menu *attempt*, just an invalid one.
    command: {
      type: 'invalid_option',
      menu: currentMenu,
      attempted: number,
      validRange: getValidMenuRange(currentMenu)
    }
  };
}

/**
 * Parses direct text-based commands.
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
    return { type: CONSTANTS.COMMAND_TYPES.SUBJECT_SWITCH, target: subject };
  }
  return null;
}

/**
 * Parses A/B/C/D answer inputs with flexible format support.
 */
function parseAnswerInput(input) {
  const cleanInput = input.trim().toUpperCase();
  const letter = cleanInput.replace(/[^A-D]/g, '');

  if (letter.length === 1 && ['A', 'B', 'C', 'D'].includes(letter)) {
    return { isValid: true, letter: letter, attempted: true };
  }

  if (/^[1-9]$/.test(cleanInput) || /^[E-Z]$/.test(cleanInput)) {
    return {
      isValid: false,
      attempted: true,
      error: `Only A, B, C, or D work for answers! 📝\nYou sent: "${input}"`
    };
  }

  return { isValid: false, attempted: false };
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
  return ranges[menuType] || 'a valid number';
}
