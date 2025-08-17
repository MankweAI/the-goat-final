/**
 * Enhanced Command Parser - 3-Option Welcome Menu
 * Date: 2025-08-17 10:59:29 UTC
 * UPDATED: Exam/Homework/Practice (removed confidence, simplified stress)
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
        originalInput
      };
    }
    if (answerResult.isInvalid) {
      return {
        type: 'invalid_answer',
        error: answerResult.error,
        originalInput
      };
    }
  }

  // ✅ PRIORITY 2: Global commands (before menu parsing)
  const globalCommand = parseGlobalCommands(trimmed, originalInput);
  if (globalCommand.type !== 'unrecognized') {
    console.log(`✅ Global command: ${globalCommand.type}`);
    return globalCommand;
  }

  // ✅ PRIORITY 3: Menu navigation
  if (context.current_menu) {
    const menuResult = parseMenuInput(originalInput, context.current_menu);
    if (menuResult.isValid) {
      console.log(`✅ Menu command:`, menuResult.command);
      return menuResult.command;
    }
    if (menuResult.isInvalid) {
      return {
        type: 'invalid_option',
        menu: context.current_menu,
        attempted: originalInput,
        validRange: menuResult.validRange,
        originalInput
      };
    }
  }

  // ✅ PRIORITY 4: Text inputs (for homework/exam prep)
  if (context.expecting_text_input) {
    return {
      type: 'text_input',
      text: originalInput,
      originalInput
    };
  }

  // ✅ PRIORITY 5: Fallback
  console.log(`⚠️ Unrecognized: "${trimmed}"`);
  return { type: 'unrecognized', originalInput };
}

// Enhanced global commands (updated for new system)
function parseGlobalCommands(trimmed, originalInput) {
  // Core flow triggers (updated)
  if (['exam', 'test', 'scared', 'prep'].includes(trimmed)) {
    return { type: CONSTANTS.COMMAND_TYPES.EXAM_PREP, action: 'start', originalInput };
  }

  if (['homework', 'hw', 'assignment'].includes(trimmed)) {
    return { type: CONSTANTS.COMMAND_TYPES.HOMEWORK, action: 'start', originalInput };
  }

  if (['practice', 'question', 'next', 'q'].includes(trimmed)) {
    return { type: CONSTANTS.COMMAND_TYPES.PRACTICE, action: 'start', originalInput };
  }

  // Navigation commands
  if (['menu', 'main', 'home', 'start'].includes(trimmed)) {
    return { type: 'welcome_menu', action: 'show', originalInput };
  }

  if (['help', '?', 'info'].includes(trimmed)) {
    return { type: CONSTANTS.COMMAND_TYPES.HELP, action: 'show', originalInput };
  }

  // Legacy aliases (hidden compatibility)
  if (['panic', 'stressed'].includes(trimmed)) {
    return { type: CONSTANTS.COMMAND_TYPES.EXAM_PREP, action: 'start', originalInput };
  }

  return { type: 'unrecognized', originalInput };
}

// Updated menu input parsing
function parseMenuInput(input, currentMenu) {
  const number = parseInt(input.trim());

  if (isNaN(number) || number <= 0) {
    return {
      isInvalid: true,
      validRange: getMenuRange(currentMenu),
      reason: 'not_a_number'
    };
  }

  // NEW: Welcome menu (3 options)
  if (currentMenu === 'welcome') {
    if (number >= 1 && number <= 3) {
      const actions = {
        1: { type: CONSTANTS.COMMAND_TYPES.EXAM_PREP, action: 'start' },
        2: { type: CONSTANTS.COMMAND_TYPES.HOMEWORK, action: 'start' },
        3: { type: CONSTANTS.COMMAND_TYPES.PRACTICE, action: 'start' }
      };
      return {
        isValid: true,
        command: { ...actions[number], originalInput: input, menuChoice: number }
      };
    }
    return { isInvalid: true, validRange: '1-3', reason: 'out_of_range' };
  }

  // Exam prep menus (simplified - no stress level)
  if (currentMenu === 'exam_prep_subject') {
    if (number >= 1 && number <= 4) {
      const subjects = { 1: 'math', 2: 'math', 3: 'math', 4: 'math' }; // MVP: all lead to math
      return {
        isValid: true,
        command: {
          type: 'exam_prep_subject_select',
          subject: subjects[number],
          originalInput: input
        }
      };
    }
    return { isInvalid: true, validRange: '1-4', reason: 'out_of_range' };
  }

  // NEW: Homework menus
  if (currentMenu === 'homework_subject') {
    if (number >= 1 && number <= 4) {
      const subjects = { 1: 'math', 2: 'math', 3: 'math', 4: 'math' }; // MVP: all lead to math
      return {
        isValid: true,
        command: {
          type: 'homework_subject_select',
          subject: subjects[number],
          originalInput: input
        }
      };
    }
    return { isInvalid: true, validRange: '1-4', reason: 'out_of_range' };
  }

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
          originalInput: input
        }
      };
    }
    return { isInvalid: true, validRange: '1-6', reason: 'out_of_range' };
  }

  if (currentMenu === 'homework_method') {
    if (number >= 1 && number <= 3) {
      const actions = { 1: 'practice', 2: 'another_example', 3: 'back_to_homework' };
      return {
        isValid: true,
        command: { type: 'homework_method_action', action: actions[number], originalInput: input }
      };
    }
    return { isInvalid: true, validRange: '1-3', reason: 'out_of_range' };
  }

  // Lesson menus (updated)
  if (currentMenu === 'lesson') {
    if (number >= 1 && number <= 3) {
      const actions = { 1: 'start_practice', 2: 'another_example', 3: 'back_to_main' };
      return {
        isValid: true,
        command: { type: 'lesson_action', action: actions[number], originalInput: input }
      };
    }
    return { isInvalid: true, validRange: '1-3', reason: 'out_of_range' };
  }

  // Practice continue menu (updated)
  if (currentMenu === 'practice_continue') {
    if (number >= 1 && number <= 4) {
      const actions = { 1: 'continue', 2: 'switch_topic', 3: 'back_to_homework', 4: 'take_break' };
      return {
        isValid: true,
        command: { type: 'practice_continue_select', action: actions[number], originalInput: input }
      };
    }
    return { isInvalid: true, validRange: '1-4', reason: 'out_of_range' };
  }

  // Unknown menu
  return {
    isInvalid: true,
    validRange: '1-5',
    reason: 'unknown_menu'
  };
}

function getMenuRange(menu) {
  const ranges = {
    welcome: '1-3',
    exam_prep_subject: '1-4',
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

  // Handle common patterns
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
