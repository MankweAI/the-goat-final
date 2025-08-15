/**
 * Enhanced Command Parser with Fixed Menu Navigation
 * Date: 2025-08-15 15:33:15 UTC
 */

import { CONSTANTS } from '../config/constants.js';

export function parseCommand(input, context = {}) {
  const trimmed = input.trim().toLowerCase();
  const originalInput = input.trim();

  console.log(`🔍 Parsing command: "${trimmed}" in menu: ${context.current_menu}`, {
    context: context
  });

  // ✅ PRIORITY 1: Handle answer submissions first
  if (context.expecting_answer || context.has_current_question) {
    const answerResult = parseAnswerInput(originalInput);
    if (answerResult.isValid) {
      return {
        type: CONSTANTS.COMMAND_TYPES.ANSWER,
        answer: answerResult.answer,
        originalInput: originalInput
      };
    }

    if (answerResult.isInvalid) {
      return {
        type: 'invalid_answer',
        error: answerResult.error,
        originalInput: originalInput
      };
    }
  }

  // ✅ PRIORITY 2: Handle registration inputs
  if (context.expecting_registration_input) {
    return {
      type: 'registration',
      action: 'process_input',
      originalInput: originalInput
    };
  }

  // ✅ PRIORITY 3: Handle friend username inputs
  if (context.expecting_username) {
    return {
      type: CONSTANTS.COMMAND_TYPES.FRIENDS,
      action: 'add_user',
      target: trimmed,
      originalInput: originalInput
    };
  }

  // ✅ PRIORITY 4: FIXED MENU NAVIGATION
  if (context.current_menu) {
    const menuResult = parseMenuInput(originalInput, context.current_menu);
    if (menuResult.isValid) {
      console.log(`✅ Valid menu input parsed:`, menuResult.command);
      return menuResult.command;
    }

    if (menuResult.isInvalid) {
      console.log(`❌ Invalid menu input:`, menuResult);
      return {
        type: 'invalid_option',
        menu: context.current_menu,
        attempted: originalInput,
        validRange: menuResult.validRange,
        originalInput: originalInput
      };
    }
  }

  // ✅ PRIORITY 5: Handle global commands
  return parseGlobalCommands(trimmed, originalInput);
}

// ✅ FIXED: Enhanced menu input parsing
function parseMenuInput(input, currentMenu) {
  try {
    const trimmed = input.trim();
    const number = parseInt(trimmed);

    console.log(`🔍 Menu parsing: input="${trimmed}", menu="${currentMenu}", number=${number}`);

    // Check if input is a valid number
    if (isNaN(number) || number <= 0) {
      return {
        isInvalid: true,
        validRange: getMenuRange(currentMenu),
        reason: 'not_a_number'
      };
    }

    // ✅ FIXED: Main menu handling (most common case)
    if (currentMenu === 'main' || !currentMenu) {
      if (number >= 1 && number <= 5) {
        const actions = {
          1: { type: CONSTANTS.COMMAND_TYPES.QUESTION, action: 'next' },
          2: { type: 'subject_menu', action: 'show' },
          3: { type: CONSTANTS.COMMAND_TYPES.REPORT, action: 'show' },
          4: { type: 'friends_menu', action: 'show' },
          5: { type: 'settings_menu', action: 'show' }
        };

        console.log(`✅ Main menu action selected: ${number}`, actions[number]);

        return {
          isValid: true,
          command: {
            ...actions[number],
            originalInput: input,
            menuChoice: number
          }
        };
      }

      return {
        isInvalid: true,
        validRange: '1-5',
        reason: 'out_of_range'
      };
    }

    // ✅ Subject menu handling
    if (currentMenu === 'subject') {
      if (number >= 1 && number <= 5) {
        const actions = {
          1: { type: CONSTANTS.COMMAND_TYPES.SUBJECT_SWITCH, target: 'math' },
          2: { type: CONSTANTS.COMMAND_TYPES.SUBJECT_SWITCH, target: 'physics' },
          3: { type: CONSTANTS.COMMAND_TYPES.SUBJECT_SWITCH, target: 'life_sciences' },
          4: { type: CONSTANTS.COMMAND_TYPES.SUBJECT_SWITCH, target: 'chemistry' },
          5: { type: 'main_menu', action: 'show' }
        };

        return {
          isValid: true,
          command: {
            ...actions[number],
            originalInput: input,
            menuChoice: number
          }
        };
      }

      return {
        isInvalid: true,
        validRange: '1-5',
        reason: 'out_of_range'
      };
    }

    // ✅ Math topics menu handling
    if (currentMenu === 'math_topics') {
      if (number >= 1 && number <= 9) {
        if (number === 9) {
          return {
            isValid: true,
            command: {
              type: 'subject_menu',
              action: 'show',
              originalInput: input,
              menuChoice: number
            }
          };
        } else {
          return {
            isValid: true,
            command: {
              type: 'math_topic_select',
              topicNumber: number,
              originalInput: input,
              menuChoice: number
            }
          };
        }
      }

      return {
        isInvalid: true,
        validRange: '1-9',
        reason: 'out_of_range'
      };
    }

    // ✅ Friends menu handling
    if (currentMenu === 'friends') {
      if (number >= 1 && number <= 4) {
        const actions = {
          1: { type: CONSTANTS.COMMAND_TYPES.FRIENDS, action: 'list' },
          2: { type: CONSTANTS.COMMAND_TYPES.FRIENDS, action: 'add_prompt' },
          3: { type: CONSTANTS.COMMAND_TYPES.CHALLENGE, action: 'prompt' },
          4: { type: 'main_menu', action: 'show' }
        };

        return {
          isValid: true,
          command: {
            ...actions[number],
            originalInput: input,
            menuChoice: number
          }
        };
      }

      return {
        isInvalid: true,
        validRange: '1-4',
        reason: 'out_of_range'
      };
    }

    // ✅ Settings menu handling
    if (currentMenu === 'settings') {
      if (number >= 1 && number <= 3) {
        const actions = {
          1: { type: 'profile', action: 'show' },
          2: { type: 'notifications', action: 'settings' },
          3: { type: 'main_menu', action: 'show' }
        };

        return {
          isValid: true,
          command: {
            ...actions[number],
            originalInput: input,
            menuChoice: number
          }
        };
      }

      return {
        isInvalid: true,
        validRange: '1-3',
        reason: 'out_of_range'
      };
    }

    // ✅ Post-answer menu handling
    if (currentMenu === 'post_answer') {
      if (number >= 1 && number <= 5) {
        return {
          isValid: true,
          command: {
            type: 'post_answer_action',
            actionNumber: number,
            originalInput: input,
            menuChoice: number
          }
        };
      }

      return {
        isInvalid: true,
        validRange: '1-5',
        reason: 'out_of_range'
      };
    }

    // Unknown menu
    console.log(`⚠️ Unknown menu type: ${currentMenu}`);
    return {
      isInvalid: true,
      validRange: '1-5',
      reason: 'unknown_menu'
    };
  } catch (error) {
    console.error(`❌ Menu parsing error:`, error);
    return {
      isInvalid: true,
      validRange: '1-5',
      reason: 'parse_error'
    };
  }
}

// ✅ Helper function to get menu range
function getMenuRange(menu) {
  const ranges = {
    main: '1-5',
    subject: '1-5',
    math_topics: '1-9',
    friends: '1-4',
    settings: '1-3',
    post_answer: '1-5'
  };

  return ranges[menu] || '1-5';
}

// ✅ Answer validation
function parseAnswerInput(input) {
  const trimmed = input.trim().toUpperCase();

  // Valid answer patterns
  const validAnswers = ['A', 'B', 'C', 'D'];

  if (validAnswers.includes(trimmed)) {
    return {
      isValid: true,
      answer: trimmed
    };
  }

  // Check common answer formats
  const answerPatterns = [
    /^([ABCD])\)$/, // A), B), etc.
    /^ANSWER\s*([ABCD])$/i, // ANSWER A
    /^OPTION\s*([ABCD])$/i, // OPTION A
    /^([ABCD])\.$/ // A., B., etc.
  ];

  for (const pattern of answerPatterns) {
    const match = trimmed.match(pattern);
    if (match && validAnswers.includes(match[1])) {
      return {
        isValid: true,
        answer: match[1]
      };
    }
  }

  return {
    isInvalid: true,
    error: `Invalid answer format! 📝\n\nFor multiple choice questions, just send:\n• A, B, C, or D\n\nTry again! 🎯`
  };
}

// ✅ Global commands (help, menu, next, etc.)
function parseGlobalCommands(trimmed, originalInput) {
  // Question commands
  if (['next', 'question', 'q'].includes(trimmed)) {
    return {
      type: CONSTANTS.COMMAND_TYPES.QUESTION,
      action: 'next',
      originalInput: originalInput
    };
  }

  // Menu commands
  if (['menu', 'main', 'home'].includes(trimmed)) {
    return {
      type: 'main_menu',
      action: 'show',
      originalInput: originalInput
    };
  }

  // Help commands
  if (['help', '?', 'info'].includes(trimmed)) {
    return {
      type: CONSTANTS.COMMAND_TYPES.HELP,
      action: 'show',
      originalInput: originalInput
    };
  }

  // Report commands
  if (['report', 'progress', 'stats'].includes(trimmed)) {
    return {
      type: CONSTANTS.COMMAND_TYPES.REPORT,
      action: 'show',
      originalInput: originalInput
    };
  }

  // Hook commands
  if (trimmed.startsWith('hook ')) {
    const hookType = trimmed.split(' ')[1];
    return {
      type: 'manual_hook',
      target: hookType,
      originalInput: originalInput
    };
  }

  if (trimmed === 'hook stats') {
    return {
      type: 'hook_stats',
      originalInput: originalInput
    };
  }

  // Default case
  console.log(`⚠️ Unrecognized global command: "${trimmed}"`);
  return {
    type: 'unrecognized',
    originalInput: originalInput
  };
}
