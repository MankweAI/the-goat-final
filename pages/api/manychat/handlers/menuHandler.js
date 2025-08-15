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
    try {
      await updateUser(user.id, {
        current_menu: 'subject',
        last_active_at: new Date().toISOString()
      });

      const response =
        `📚 **CHOOSE YOUR SUBJECT**\n\n` +
        `Which subject do you want to dominate?\n\n` +
        `1️⃣ 🧮 **Mathematics**\n` +
        `   → Algebra, Geometry, Trigonometry, Calculus...\n\n` +
        `2️⃣ ⚡ **Physics**\n` +
        `   → Mechanics, Waves, Electricity, Magnetism...\n\n` +
        `3️⃣ 🧬 **Life Sciences**\n` +
        `   → Biology, Human Body, Ecology, Genetics...\n\n` +
        `4️⃣ ⚗️ **Chemistry**\n` +
        `   → Reactions, Organic, Stoichiometry, Acids...\n\n` +
        `5️⃣ 🏠 Back to main menu\n\n` +
        `💡 Tip: Math has multiple topic choices!\n\n` +
        `Type the number! 🎯`;

      console.log(`📱 Showing enhanced subject menu to user ${user.id}`);
      return response;
    } catch (error) {
      console.error(`❌ Subject menu error:`, error);
      return `Eish, couldn't load subjects. Try "menu"! 🔄`;
    }
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
