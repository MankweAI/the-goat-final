import { CONSTANTS } from '../config/constants.js';

export function parseCommand(message, userContext = {}) {
  const msg = message.trim().toLowerCase();
  const currentMenu = userContext.current_menu || null;

  // PRIORITY 1: Hook commands (for testing) - Must come FIRST
  if (msg.startsWith('hook ')) {
    const hookType = msg.replace('hook ', '').trim();
    return {
      type: 'manual_hook',
      action: 'send',
      target: hookType
    };
  }

  // Hook stats command
  if (msg === 'hook stats') {
    return { type: 'hook_stats', action: 'show' };
  }

  // PRIORITY 2: Registration flow responses
  if (userContext.expecting_registration_input) {
    return {
      type: 'registration',
      action: 'process_input',
      value: message.trim()
    };
  }

  // PRIORITY 3: Menu keyword
  if (msg === 'menu') {
    return { type: 'main_menu', action: 'show' };
  }

  // PRIORITY 4: Numbered menu selections
  if (/^\d+$/.test(msg)) {
    const number = parseInt(msg);
    return parseMenuSelection(number, currentMenu);
  }

  // PRIORITY 5: Direct question request (backwards compatibility)
  if (['next', 'question', 'q'].includes(msg)) {
    return { type: 'question', action: 'next' };
  }

  // PRIORITY 6: Direct report request
  if (['report', 'stats', 'progress'].includes(msg)) {
    return { type: 'report', action: 'show' };
  }

  // PRIORITY 7: Letter answers (A, B, C, D)
  if (/^[abcd]$/i.test(msg)) {
    return {
      type: 'answer',
      action: 'submit',
      value: msg.toUpperCase()
    };
  }

  // PRIORITY 8: Username input (when adding friends)
  if (userContext.expecting_username) {
    return {
      type: 'friends',
      action: 'add_user',
      target: msg.replace('@', '').trim()
    };
  }

  // PRIORITY 9: Challenge username input
  if (userContext.expecting_challenge_username) {
    return {
      type: 'challenge',
      action: 'send',
      target: msg.replace('@', '').trim()
    };
  }

  // PRIORITY 10: Default fallback
  return { type: 'unknown_command', action: 'show_menu' };
}

function parseMenuSelection(number, currentMenu) {
  switch (currentMenu) {
    case 'main_menu':
      const mainOption = CONSTANTS.MAIN_MENU_OPTIONS[number];
      return mainOption || { type: 'invalid_option', menu: 'main' };

    case 'subject_menu':
      const subjectOption = CONSTANTS.SUBJECT_MENU_OPTIONS[number];
      if (!subjectOption) return { type: 'invalid_option', menu: 'subject' };

      if (subjectOption.subject) {
        return {
          type: 'subject_switch',
          action: 'switch',
          target: subjectOption.subject,
          subject_name: subjectOption.name
        };
      }
      return subjectOption;

    case 'friends_menu':
      const friendOption = CONSTANTS.FRIENDS_MENU_OPTIONS[number];
      return friendOption || { type: 'invalid_option', menu: 'friends' };

    default:
      // No current menu context - treat as main menu
      const defaultOption = CONSTANTS.MAIN_MENU_OPTIONS[number];
      return defaultOption || { type: 'main_menu', action: 'show' };
  }
}

export function isValidMenuOption(number, menuType) {
  const options = {
    main_menu: CONSTANTS.MAIN_MENU_OPTIONS,
    subject_menu: CONSTANTS.SUBJECT_MENU_OPTIONS,
    friends_menu: CONSTANTS.FRIENDS_MENU_OPTIONS
  };

  return options[menuType] && options[menuType][number];
}

export function getMenuOptions(menuType) {
  const options = {
    main_menu: CONSTANTS.MAIN_MENU_OPTIONS,
    subject_menu: CONSTANTS.SUBJECT_MENU_OPTIONS,
    friends_menu: CONSTANTS.FRIENDS_MENU_OPTIONS
  };

  return options[menuType] || {};
}
