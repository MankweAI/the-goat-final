import { updateUser } from '../services/userService.js';
import { MESSAGES } from '../config/constants.js';

export class MenuHandler {
  async showMainMenu(user) {
    // Clear any menu context
    await updateUser(user.id, {
      current_menu: 'main_menu',
      expecting_input: null
    });

    return MESSAGES.MENUS.MAIN;
  }

  async showSubjectMenu(user) {
    await updateUser(user.id, { current_menu: 'subject_menu' });
    return MESSAGES.MENUS.SUBJECTS;
  }

  async showFriendsMenu(user) {
    await updateUser(user.id, { current_menu: 'friends_menu' });
    return MESSAGES.MENUS.FRIENDS;
  }

  async showSettingsMenu(user) {
    await updateUser(user.id, { current_menu: 'settings_menu' });
    return MESSAGES.MENUS.SETTINGS;
  }

  async promptAddFriend(user) {
    await updateUser(user.id, {
      current_menu: null,
      expecting_input: 'username_for_friend'
    });

    return MESSAGES.FRIENDS.ADD_PROMPT;
  }

  async promptChallengeFriend(user) {
    await updateUser(user.id, {
      current_menu: null,
      expecting_input: 'username_for_challenge'
    });

    return MESSAGES.FRIENDS.CHALLENGE_PROMPT;
  }

  handleInvalidOption(menuType) {
    const menuNames = {
      main: 'main menu',
      subject: 'subject menu',
      friends: 'friends menu'
    };

    const menuName = menuNames[menuType] || 'menu';
    return `Eish, that's not a valid option for the ${menuName}! 📱\n\nType "menu" to see your options again! 🎯`;
  }
}

export const menuHandler = new MenuHandler();

