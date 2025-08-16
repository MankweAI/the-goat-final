/**
 * Enhanced Command Parser with Fixed Logic Priority and Validation
 * Date: 2025-08-16 14:24:55 UTC
 */

import { CONSTANTS } from '../config/constants.js';

export function parseCommand(input, context = {}) {
  const trimmed = input.trim().toLowerCase();
  const originalInput = input.trim();

  console.log(`🔍 Parsing command: "${trimmed}" with context:`, context);

  // PRIORITY 1: Handle answer submissions if a question is active
  if (context.expecting_answer || context.has_current_question) {
    const answerResult = parseAnswerInput(originalInput);
    if (answerResult.isValid) {
      return { type: CONSTANTS.COMMAND_TYPES.ANSWER, answer: answerResult.answer };
    }
    if (answerResult.isInvalid) {
      return { type: 'invalid_answer', error: answerResult.error };
    }
  }

  // PRIORITY 2: Handle numbered menu inputs BEFORE global text commands
  if (context.current_menu) {
    const menuResult = parseMenuInput(originalInput, context.current_menu);
    if (menuResult.isValid) {
      console.log(`✅ Valid menu input parsed:`, menuResult.command);
      return menuResult.command;
    }
  }

  // PRIORITY 3: Handle global text commands
  const globalCommand = parseGlobalCommands(trimmed, originalInput);
  if (globalCommand.type !== 'unrecognized') {
    console.log(`✅ Global command recognized: ${globalCommand.type}`);
    return globalCommand;
  }

  // PRIORITY 4: Handle contextual text inputs
  if (context.expecting_registration_input) {
    return { type: 'registration', action: 'process_input', originalInput };
  }
  if (context.expecting_username) {
    return { type: CONSTANTS.COMMAND_TYPES.FRIENDS, action: 'add_user', target: trimmed };
  }

  // PRIORITY 5: Invalid option for current menu
  if (context.current_menu) {
    return {
      type: 'invalid_option',
      menu: context.current_menu,
      attempted: originalInput,
      validRange: getMenuRange(context.current_menu)
    };
  }

  // DEFAULT: Fallback for unrecognized input
  console.log(`⚠️ Unrecognized input: "${trimmed}"`);
  return { type: 'unrecognized', originalInput };
}

function parseMenuInput(input, currentMenu) {
  const number = parseInt(input.trim(), 10);
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
    },
    // NEW: Panic/Therapy generic numeric handlers
    panic: {
      1: { type: 'panic_menu', choice: 1 },
      2: { type: 'panic_menu', choice: 2 },
      3: { type: 'panic_menu', choice: 3 },
      4: { type: 'panic_menu', choice: 4 },
      5: { type: 'panic_menu', choice: 5 }
    },
    therapy: {
      1: { type: 'therapy_menu', choice: 1 },
      2: { type: 'therapy_menu', choice: 2 },
      3: { type: 'therapy_menu', choice: 3 },
      4: { type: 'therapy_menu', choice: 4 },
      5: { type: 'therapy_menu', choice: 5 }
    }
  };

  const mapping = menuMappings[currentMenu];
  if (mapping && mapping[number]) {
    return { isValid: true, command: { ...mapping[number], menuChoice: number } };
  }

  return { isValid: false };
}

function parseGlobalCommands(trimmed, originalInput) {
  const commandMap = {
    next: { type: CONSTANTS.COMMAND_TYPES.QUESTION, action: 'next' },
    menu: { type: 'main_menu', action: 'show' },
    help: { type: CONSTANTS.COMMAND_TYPES.HELP, action: 'show' },
    report: { type: CONSTANTS.COMMAND_TYPES.REPORT, action: 'show' },
    subjects: { type: 'subject_menu', action: 'show' },
    friends: { type: 'friends_menu', action: 'show' },
    panic: { type: 'panic', action: 'start' },
    'panic mode': { type: 'panic', action: 'start' },
    therapy: { type: 'therapy', action: 'start' }
  };

  if (commandMap[trimmed]) {
    return { ...commandMap[trimmed], originalInput };
  }

  if (trimmed.startsWith('hook ')) {
    const target = trimmed.split(' ')[1];
    if (target && /^[a-z]+$/.test(target)) {
      return { type: 'manual_hook', target, originalInput };
    }
  }
  if (trimmed === 'hook stats') {
    return { type: 'hook_stats', originalInput };
  }

  return { type: 'unrecognized', originalInput };
}

function parseAnswerInput(input) {
  const trimmed = input.trim().toUpperCase();
  const validAnswers = ['A', 'B', 'C', 'D'];

  if (validAnswers.includes(trimmed)) {
    return { isValid: true, answer: trimmed };
  }

  if (trimmed.length > 0 && validAnswers.includes(trimmed.charAt(0))) {
    const letter = trimmed.charAt(0);
    if (/^[\.\)]?$/.test(trimmed.slice(1))) {
      return { isValid: true, answer: letter };
    }
  }

  if (trimmed.length > 0) {
    return {
      isInvalid: true,
      error: `Invalid answer! 📝\n\nFor multiple choice questions, send A, B, C, or D only.`
    };
  }

  return { isValid: false, isInvalid: false };
}

function getMenuRange(menu) {
  const ranges = {
    main: '1-5',
    subject: '1-5',
    math_topics: '1-9',
    friends: '1-4',
    settings: '1-3',
    post_answer: '1-5',
    panic: '1-5',
    therapy: '1-5'
  };
  return ranges[menu] || 'a valid number';
}
