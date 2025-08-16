/**
 * Enhanced Command Parser - Stress & Confidence Focus
 * Date: 2025-08-16 16:53:38 UTC
 * Priority: Global commands → Menu navigation → Fallbacks
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

  // ✅ PRIORITY 4: Contextual inputs
  if (context.expecting_registration_input) {
    return { type: 'registration', action: 'process_input', originalInput };
  }

  // ✅ PRIORITY 5: Fallback
  console.log(`⚠️ Unrecognized: "${trimmed}"`);
  return { type: 'unrecognized', originalInput };
}

// ✅ Enhanced global commands (moved up in priority)
function parseGlobalCommands(trimmed, originalInput) {
  // Core flow triggers
  if (['stressed', 'stress', 'steady', 'reset'].includes(trimmed)) {
    return { type: CONSTANTS.COMMAND_TYPES.STRESSED, action: 'start', originalInput };
  }

  if (['boost', 'confidence', 'doubt'].includes(trimmed)) {
    return { type: CONSTANTS.COMMAND_TYPES.CONFIDENCE_BOOST, action: 'start', originalInput };
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

  // Plan management
  if (['stop plan', 'cancel plan', 'no plan'].includes(trimmed)) {
    return { type: 'plan_cancel', action: 'stop', originalInput };
  }

  if (trimmed.startsWith('change time ')) {
    const timeString = trimmed.replace('change time ', '').trim();
    return { type: 'plan_time_change', time: timeString, originalInput };
  }

  // Legacy aliases (hidden compatibility)
  if (['panic', 'therapy'].includes(trimmed)) {
    const newType = trimmed === 'panic' ? 'stressed' : 'confidence_boost';
    return { type: CONSTANTS.COMMAND_TYPES[newType.toUpperCase()], action: 'start', originalInput };
  }

  return { type: 'unrecognized', originalInput };
}

// ✅ Menu input parsing (updated for new flows)
function parseMenuInput(input, currentMenu) {
  const number = parseInt(input.trim());

  if (isNaN(number) || number <= 0) {
    return {
      isInvalid: true,
      validRange: getMenuRange(currentMenu),
      reason: 'not_a_number'
    };
  }

  // Welcome menu (NEW - core triage)
  if (currentMenu === 'welcome') {
    if (number >= 1 && number <= 3) {
      const actions = {
        1: { type: CONSTANTS.COMMAND_TYPES.STRESSED, action: 'start' },
        2: { type: CONSTANTS.COMMAND_TYPES.CONFIDENCE_BOOST, action: 'start' },
        3: { type: CONSTANTS.COMMAND_TYPES.PRACTICE, action: 'start' }
      };
      return {
        isValid: true,
        command: { ...actions[number], originalInput: input, menuChoice: number }
      };
    }
    return { isInvalid: true, validRange: '1-3', reason: 'out_of_range' };
  }

  // Stress intake menus
  if (currentMenu === 'stress_level') {
    if (number >= 1 && number <= 4) {
      return {
        isValid: true,
        command: { type: 'stress_level_select', level: number, originalInput: input }
      };
    }
    return { isInvalid: true, validRange: '1-4', reason: 'out_of_range' };
  }

  if (currentMenu === 'stress_subject') {
    if (number >= 1 && number <= 4) {
      const subjects = { 1: 'math', 2: 'math', 3: 'math', 4: 'math' }; // MVP: all lead to math
      return {
        isValid: true,
        command: { type: 'stress_subject_select', subject: subjects[number], originalInput: input }
      };
    }
    return { isInvalid: true, validRange: '1-4', reason: 'out_of_range' };
  }

  // Confidence intake menus
  if (currentMenu === 'confidence_reason') {
    if (number >= 1 && number <= 5) {
      const reasons = { 1: 'failed', 2: 'confused', 3: 'comparison', 4: 'comment', 5: 'other' };
      return {
        isValid: true,
        command: { type: 'confidence_reason_select', reason: reasons[number], originalInput: input }
      };
    }
    return { isInvalid: true, validRange: '1-5', reason: 'out_of_range' };
  }

  if (currentMenu === 'confidence_ladder') {
    if (number >= 1 && number <= 4) {
      const actions = { 1: 'r1_easy', 2: 'r2_reflect', 3: 'r3_medium', 4: 'skip' };
      return {
        isValid: true,
        command: { type: 'confidence_ladder_select', action: actions[number], originalInput: input }
      };
    }
    return { isInvalid: true, validRange: '1-4', reason: 'out_of_range' };
  }

  // Lesson menus
  if (currentMenu === 'lesson') {
    if (number >= 1 && number <= 3) {
      const actions = { 1: 'start_practice', 2: 'another_example', 3: 'cancel' };
      return {
        isValid: true,
        command: { type: 'lesson_action', action: actions[number], originalInput: input }
      };
    }
    return { isInvalid: true, validRange: '1-3', reason: 'out_of_range' };
  }

  // Practice continue menu
  if (currentMenu === 'practice_continue') {
    if (number >= 1 && number <= 4) {
      const actions = { 1: 'continue', 2: 'switch_topic', 3: 'short_break', 4: 'remind_tonight' };
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
    stress_level: '1-4',
    stress_subject: '1-4',
    confidence_reason: '1-5',
    confidence_ladder: '1-4',
    lesson: '1-3',
    practice_continue: '1-4'
  };
  return ranges[menu] || '1-5';
}

// ✅ Answer validation (unchanged)
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
