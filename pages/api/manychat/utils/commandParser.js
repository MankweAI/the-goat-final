/**
 * Enhanced Command Parser - FIXED Exam Prep Plan Menu Bug
 * Date: 2025-08-17 12:37:33 UTC
 * CRITICAL FIX: Added missing exam_prep_plan and exam_prep_plan_decision menu cases
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

// Text input context detection
function isTextInputContext(currentMenu) {
  const textInputMenus = [
    'exam_prep_grade',
    'homework_grade',
    'homework_confusion',
    'exam_prep_problems',
    'exam_prep_exam_date',
    'exam_prep_time'
  ];

  return textInputMenus.includes(currentMenu);
}

// Global commands
function parseGlobalCommands(trimmed, originalInput) {
  if (['exam', 'test', 'scared', 'prep'].includes(trimmed)) {
    return { type: CONSTANTS.COMMAND_TYPES.EXAM_PREP, action: 'start', originalInput };
  }

  if (['homework', 'hw', 'assignment'].includes(trimmed)) {
    return { type: CONSTANTS.COMMAND_TYPES.HOMEWORK, action: 'start', originalInput };
  }

  if (['practice', 'question', 'next', 'q'].includes(trimmed)) {
    return { type: CONSTANTS.COMMAND_TYPES.PRACTICE, action: 'start', originalInput };
  }

  if (['menu', 'main', 'home', 'start'].includes(trimmed)) {
    return { type: 'welcome_menu', action: 'show', originalInput };
  }

  if (['help', '?', 'info'].includes(trimmed)) {
    return { type: CONSTANTS.COMMAND_TYPES.HELP, action: 'show', originalInput };
  }

  if (['panic', 'stressed'].includes(trimmed)) {
    return { type: CONSTANTS.COMMAND_TYPES.EXAM_PREP, action: 'start', originalInput };
  }

  return { type: 'unrecognized', originalInput };
}

// FIXED: Menu input parsing with ALL missing menu cases
function parseMenuInput(input, currentMenu) {
  const number = parseInt(input.trim());

  if (isNaN(number) || number <= 0) {
    return {
      isInvalid: true,
      validRange: getMenuRange(currentMenu),
      reason: 'not_a_number'
    };
  }

  // Welcome menu (3 options)
  if (currentMenu === 'welcome') {
    if (number >= 1 && number <= 3) {
      const actions = {
        1: { type: CONSTANTS.COMMAND_TYPES.EXAM_PREP, action: 'start' },
        2: { type: CONSTANTS.COMMAND_TYPES.HOMEWORK, action: 'start' },
        3: { type: CONSTANTS.COMMAND_TYPES.PRACTICE, action: 'start' }
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
    return { isInvalid: true, validRange: '1-3', reason: 'out_of_range' };
  }

  // Exam prep subject menu
  if (currentMenu === 'exam_prep_subject') {
    if (number >= 1 && number <= 4) {
      return {
        isValid: true,
        command: {
          type: 'exam_prep_subject_select',
          subject: 'math',
          originalInput: input,
          menuChoice: number
        }
      };
    }
    return { isInvalid: true, validRange: '1-4', reason: 'out_of_range' };
  }

  // CRITICAL FIX: Exam prep plan menu (the missing case!)
  if (currentMenu === 'exam_prep_plan') {
    if (number >= 1 && number <= 3) {
      const actions = {
        1: 'begin_review',
        2: 'switch_topic',
        3: 'main_menu'
      };
      return {
        isValid: true,
        command: {
          type: 'exam_prep_plan_action',
          action: actions[number],
          originalInput: input,
          menuChoice: number
        }
      };
    }
    return { isInvalid: true, validRange: '1-3', reason: 'out_of_range' };
  }

  // CRITICAL FIX: Exam prep plan decision menu
  if (currentMenu === 'exam_prep_plan_decision') {
    if (number >= 1 && number <= 2) {
      const actions = { 1: 'yes_to_plan', 2: 'no_to_plan' };
      return {
        isValid: true,
        command: {
          type: 'exam_prep_plan_decision_select',
          decision: actions[number],
          originalInput: input,
          menuChoice: number
        }
      };
    }
    return { isInvalid: true, validRange: '1-2', reason: 'out_of_range' };
  }

  // Homework subject menu
  if (currentMenu === 'homework_subject') {
    if (number >= 1 && number <= 4) {
      return {
        isValid: true,
        command: {
          type: 'homework_subject_select',
          subject: 'math',
          originalInput: input,
          menuChoice: number
        }
      };
    }
    return { isInvalid: true, validRange: '1-4', reason: 'out_of_range' };
  }

  // Homework problem type menu
  if (currentMenu === 'homework_problem_type') {
    if (number >= 1 && number <= 6) {
      const problemTypes = {
        1: 'equations',
        2: 'word_problems',
        3: 'graphs_functions',
        4: 'calculus',
        5: 'trigonometry',
        6: 'other'
      };
      return {
        isValid: true,
        command: {
          type: 'homework_problem_type_select',
          problem_type: problemTypes[number],
          originalInput: input,
          menuChoice: number
        }
      };
    }
    return { isInvalid: true, validRange: '1-6', reason: 'out_of_range' };
  }

  // Homework method menu
  if (currentMenu === 'homework_method') {
    if (number >= 1 && number <= 3) {
      const actions = { 1: 'practice', 2: 'another_example', 3: 'back_to_homework' };
      return {
        isValid: true,
        command: {
          type: 'homework_method_action',
          action: actions[number],
          originalInput: input,
          menuChoice: number
        }
      };
    }
    return { isInvalid: true, validRange: '1-3', reason: 'out_of_range' };
  }

  // Lesson menu
  if (currentMenu === 'lesson') {
    if (number >= 1 && number <= 3) {
      const actions = { 1: 'start_practice', 2: 'another_example', 3: 'back_to_main' };
      return {
        isValid: true,
        command: {
          type: 'lesson_action',
          action: actions[number],
          originalInput: input,
          menuChoice: number
        }
      };
    }
    return { isInvalid: true, validRange: '1-3', reason: 'out_of_range' };
  }

  // Practice continue menu
  if (currentMenu === 'practice_continue') {
    if (number >= 1 && number <= 4) {
      const actions = { 1: 'continue', 2: 'switch_topic', 3: 'back_to_homework', 4: 'take_break' };
      return {
        isValid: true,
        command: {
          type: 'practice_continue_select',
          action: actions[number],
          originalInput: input,
          menuChoice: number
        }
      };
    }
    return { isInvalid: true, validRange: '1-4', reason: 'out_of_range' };
  }

  // Unknown menu
  console.warn(`⚠️ Unknown menu type: ${currentMenu}`);
  return {
    isInvalid: true,
    validRange: getMenuRange(currentMenu),
    reason: 'unknown_menu'
  };
}

function getMenuRange(menu) {
  const ranges = {
    welcome: '1-3',
    exam_prep_subject: '1-4',
    exam_prep_plan: '1-3', // CRITICAL FIX: Added missing range
    exam_prep_plan_decision: '1-2', // CRITICAL FIX: Added missing range
    homework_subject: '1-4',
    homework_problem_type: '1-6',
    homework_method: '1-3',
    lesson: '1-3',
    practice_continue: '1-4'
  };
  return ranges[menu] || '1-5';
}

// Answer validation (unchanged)
function parseAnswerInput(input) {
  const trimmed = input.trim().toUpperCase();
  const validAnswers = CONSTANTS.VALID_ANSWERS;

  if (validAnswers.includes(trimmed)) {
    return { isValid: true, answer: trimmed };
  }

  const patterns = [/^([ABCD])\)$/, /^ANSWER\s*([ABCD])$/i, /^([ABCD])\.$/];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && validAnswers.includes(match[1])) {
      return { isValid: true, answer: match[1] };
    }
  }

  return {
    isInvalid: true,
    error: CONSTANTS.MESSAGES.ERRORS.INVALID_ANSWER
  };
}
