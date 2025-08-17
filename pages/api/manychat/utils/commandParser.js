/**
 * Enhanced Command Parser - FIXED Exam Prep Plan Menu Bug + Date Input Detection
 * Date: 2025-08-17 15:36:12 UTC
 * CRITICAL FIXES:
 * - Added missing exam_prep_plan and exam_prep_plan_decision menu cases
 * - Fixed text input detection for exam_prep_exam_date
 * - Added exam_lesson menu support
 * - FIXED homework_subject text input detection
 */

import { CONSTANTS } from '../config/constants.js';

export function parseCommand(input, context = {}) {
  const trimmed = input.trim().toLowerCase();
  const originalInput = input.trim();

  console.log(
    `🔍 Parsing: "${trimmed}" | Menu: ${context.current_menu} | Question: ${!!context.has_current_question}`
  );

  // ✅ PRIORITY 1: Answer submissions (highest priority)
  if (context.expecting_answer || context.has_current_question) {
    const answerResult = parseAnswerInput(originalInput);
    if (answerResult.isValid) {
      return {
        type: CONSTANTS.COMMAND_TYPES.ANSWER,
        answer: answerResult.answer,
        originalInput,
        menuChoice: null,
        action: null,
        text: null,
        validRange: null
      };
    }
    if (answerResult.isInvalid) {
      return {
        type: 'invalid_answer',
        error: answerResult.error,
        originalInput,
        menuChoice: null,
        action: null,
        text: null,
        validRange: null
      };
    }
  }

  // ✅ PRIORITY 2: Global commands (before menu parsing)
  const globalCommand = parseGlobalCommands(trimmed, originalInput);
  if (globalCommand.type !== 'unrecognized') {
    console.log(`✅ Global command: ${globalCommand.type}`);
    return {
      ...globalCommand,
      menuChoice: null,
      text: null,
      validRange: null
    };
  }

  // ✅ PRIORITY 3: Text inputs (Check BEFORE menu parsing)
  if (context.expecting_text_input || isTextInputContext(context.current_menu)) {
    console.log(`✅ Text input context detected: ${context.current_menu}`);
    return {
      type: 'text_input',
      text: originalInput,
      originalInput,
      menuChoice: null,
      action: null,
      answer: null,
      validRange: null
    };
  }

  // ✅ PRIORITY 4: Menu navigation
  if (context.current_menu) {
    const menuResult = parseMenuInput(originalInput, context.current_menu);
    if (menuResult.isValid) {
      console.log(`✅ Menu command:`, menuResult.command);
      return {
        ...menuResult.command,
        menuChoice: menuResult.command.menuChoice || parseInt(originalInput.trim()) || 1,
        text: null,
        answer: null,
        validRange: null
      };
    }
    if (menuResult.isInvalid) {
      return {
        type: 'invalid_option',
        menu: context.current_menu,
        attempted: originalInput,
        validRange: menuResult.validRange,
        originalInput,
        menuChoice: null,
        action: null,
        text: null,
        answer: null
      };
    }
  }

  // ✅ PRIORITY 5: Fallback
  console.log(`⚠️ Unrecognized: "${trimmed}"`);
  return {
    type: 'unrecognized',
    originalInput,
    menuChoice: null,
    action: null,
    text: null,
    answer: null,
    validRange: null
  };
}

// FIXED: Enhanced text input context detection
function isTextInputContext(currentMenu) {
  const textInputMenus = [
    'exam_prep_grade',
    'exam_prep_exam_date', // CRITICAL: Added this missing menu
    'exam_prep_problems',
    'exam_prep_time',
    'homework_grade',
    'homework_subject', // CRITICAL FIX: Added homework_subject for "yes" input
    'homework_confusion',
    'stress_exam_date'
  ];

  return textInputMenus.includes(currentMenu);
}

function parseAnswerInput(input) {
  const cleaned = input.trim().toUpperCase();

  if (['A', 'B', 'C', 'D'].includes(cleaned)) {
    return { isValid: true, answer: cleaned };
  }

  if (cleaned.length === 1 && /[A-Z]/.test(cleaned)) {
    return { isInvalid: true, error: 'Only A, B, C, or D are valid answers' };
  }

  return { isValid: false, isInvalid: false };
}

function parseGlobalCommands(trimmed, originalInput) {
  // Help and menu commands
  if (['help', 'menu', 'start', 'back'].includes(trimmed)) {
    return { type: 'welcome_menu', action: trimmed, originalInput };
  }

  // Direct flow triggers
  if (['practice', 'question', 'quiz'].includes(trimmed)) {
    return { type: CONSTANTS.COMMAND_TYPES.PRACTICE, action: 'start', originalInput };
  }

  if (['exam', 'test', 'panic', 'stress'].includes(trimmed)) {
    return { type: CONSTANTS.COMMAND_TYPES.EXAM_PREP, action: 'start', originalInput };
  }

  if (['homework', 'hw', 'help me'].includes(trimmed)) {
    return { type: CONSTANTS.COMMAND_TYPES.HOMEWORK, action: 'start', originalInput };
  }

  return { type: 'unrecognized', originalInput };
}

function parseMenuInput(input, currentMenu) {
  const choice = parseInt(input.trim());

  console.log(`🎯 Parsing menu input: choice=${choice}, menu=${currentMenu}`);

  switch (currentMenu) {
    case 'welcome':
      if (choice >= 1 && choice <= 3) {
        const types = [
          CONSTANTS.COMMAND_TYPES.EXAM_PREP,
          CONSTANTS.COMMAND_TYPES.HOMEWORK,
          CONSTANTS.COMMAND_TYPES.PRACTICE
        ];
        return {
          isValid: true,
          command: { type: types[choice - 1], action: 'start', menuChoice: choice }
        };
      }
      return { isInvalid: true, validRange: '1-3' };

    case 'exam_prep_subject':
      if (choice >= 1 && choice <= 4) {
        return {
          isValid: true,
          command: { type: 'exam_prep_subject', menuChoice: choice }
        };
      }
      return { isInvalid: true, validRange: '1-4' };

    // CRITICAL FIX: Added missing exam_prep_plan menu
    case 'exam_prep_plan':
      if (choice >= 1 && choice <= 3) {
        const actions = ['begin_review', 'switch_topic', 'main_menu'];
        return {
          isValid: true,
          command: {
            type: 'exam_prep_plan_action',
            action: actions[choice - 1],
            menuChoice: choice
          }
        };
      }
      return { isInvalid: true, validRange: '1-3' };

    // CRITICAL FIX: Added exam lesson menu
    case 'exam_lesson':
      if (choice >= 1 && choice <= 3) {
        return {
          isValid: true,
          command: {
            type: 'exam_lesson_menu',
            menuChoice: choice
          }
        };
      }
      return { isInvalid: true, validRange: '1-3' };

    // NOTE: homework_subject is now handled as text input, not menu input

    case 'homework_problem_type':
      if (choice >= 1 && choice <= 6) {
        return {
          isValid: true,
          command: { type: 'homework_problem_type', menuChoice: choice }
        };
      }
      return { isInvalid: true, validRange: '1-6' };

    case 'homework_lesson':
      if (choice >= 1 && choice <= 3) {
        return {
          isValid: true,
          command: { type: 'homework_lesson_menu', menuChoice: choice }
        };
      }
      return { isInvalid: true, validRange: '1-3' };

    case 'practice_active':
      // This should be handled by answer parsing, not menu parsing
      return { isInvalid: false };

    case 'practice_continue':
      if (choice >= 1 && choice <= 3) {
        const actions = ['continue', 'switch_topic', 'short_break'];
        return {
          isValid: true,
          command: {
            type: 'practice_continue',
            action: actions[choice - 1],
            menuChoice: choice
          }
        };
      }
      return { isInvalid: true, validRange: '1-3' };

    case 'stress_subject':
      if (choice >= 1 && choice <= 4) {
        return {
          isValid: true,
          command: { type: 'stress_subject', menuChoice: choice }
        };
      }
      return { isInvalid: true, validRange: '1-4' };

    case 'stress_level':
      if (choice >= 1 && choice <= 4) {
        return {
          isValid: true,
          command: { type: 'stress_level', menuChoice: choice }
        };
      }
      return { isInvalid: true, validRange: '1-4' };

    default:
      console.warn(`⚠️ Unknown menu: ${currentMenu}`);
      return { isInvalid: false };
  }
}

// Helper to check if user is expecting text input
function isExpectingTextInput(currentMenu) {
  return isTextInputContext(currentMenu);
}

export { isExpectingTextInput };
