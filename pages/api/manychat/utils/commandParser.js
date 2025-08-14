import { CONSTANTS } from '../config/constants.js';

export function parseCommand(message) {
  const msg = message.trim().toLowerCase();

  // Direct command matches
  const directCommands = {
    next: { type: CONSTANTS.COMMAND_TYPES.QUESTION, action: 'next' },
    report: { type: CONSTANTS.COMMAND_TYPES.REPORT, action: 'show' },
    stats: { type: CONSTANTS.COMMAND_TYPES.REPORT, action: 'show' },
    'my stats': { type: CONSTANTS.COMMAND_TYPES.REPORT, action: 'show' },
    'my progress': { type: CONSTANTS.COMMAND_TYPES.REPORT, action: 'show' },
    help: { type: CONSTANTS.COMMAND_TYPES.HELP, action: 'show' },
    'my friends': { type: CONSTANTS.COMMAND_TYPES.FRIENDS, action: 'list' },
    'friend code': { type: CONSTANTS.COMMAND_TYPES.FRIENDS, action: 'show_code' },
    friends: { type: CONSTANTS.COMMAND_TYPES.FRIENDS, action: 'list' }
  };

  if (directCommands[msg]) {
    return directCommands[msg];
  }

  // Pattern matching for complex commands
  if (msg.startsWith('add friend ')) {
    const friendCode = msg.replace('add friend ', '').trim().toUpperCase();
    return {
      type: CONSTANTS.COMMAND_TYPES.FRIENDS,
      action: 'add',
      target: friendCode
    };
  }

  if (msg.startsWith('challenge ')) {
    const target = msg.replace('challenge ', '').trim();
    return {
      type: CONSTANTS.COMMAND_TYPES.CHALLENGE,
      action: 'send',
      target: target.replace('@', '')
    };
  }

  if (msg.startsWith('switch to ')) {
    const subject = msg.replace('switch to ', '').trim();
    return {
      type: CONSTANTS.COMMAND_TYPES.SUBJECT_SWITCH,
      action: 'switch',
      target: subject
    };
  }

  // Check if it's a single letter answer
  if (/^[abcd]$/i.test(msg)) {
    return {
      type: CONSTANTS.COMMAND_TYPES.ANSWER,
      action: 'submit',
      value: msg.toUpperCase()
    };
  }

  // Default to question request for any other input
  return { type: CONSTANTS.COMMAND_TYPES.QUESTION, action: 'next' };
}

export function isValidAnswer(answer) {
  return /^[ABCD]$/i.test(answer?.trim());
}

export function normalizeAnswer(answer) {
  return answer?.trim().toUpperCase();
}
