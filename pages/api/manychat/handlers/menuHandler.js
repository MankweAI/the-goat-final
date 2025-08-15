import { updateUser } from '../services/userService.js';
import { MESSAGES } from '../config/constants.js';

export class MenuHandler {
  async showMainMenu(user) {
    try {
      await updateUser(user.id, {
        current_menu: 'main',
        expecting_input: null,
        last_active_at: new Date().toISOString()
      });

      return MESSAGES.MENUS.MAIN;
    } catch (error) {
      console.error(`❌ Main menu error:`, error);
      return `Eish, couldn't load main menu. Try "menu" again! 🔄`;
    }
  }

  async showSubjectMenu(user) {
    try {
      await updateUser(user.id, {
        current_menu: 'subject',
        expecting_input: null,
        last_active_at: new Date().toISOString()
      });

      const response =
        `📚 **CHOOSE YOUR SUBJECT**\n\n` +
        `Which subject do you want to dominate?\n\n` +
        `1️⃣ 🧮 **Mathematics**\n` +
        `   → Algebra, Geometry, Trigonometry, Calculus...\n\n` +
        `2️⃣ ⚡ **Physics**\n` +
        `   → Mechanics, Waves, Electricity, Magnetism...\n\n` +
        `3️⃣ 🧬 **Life Sciences**\n` +
        `   → Biology, Human Body, Ecology, Genetics...\n\n` +
        `4️⃣ ⚗️ **Chemistry**\n` +
        `   → Reactions, Organic, Stoichiometry, Acids...\n\n` +
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
    try {
      await updateUser(user.id, {
        current_menu: 'friends_menu',
        expecting_input: null,
        last_active_at: new Date().toISOString()
      });
      return MESSAGES.MENUS.FRIENDS;
    } catch (error) {
      console.error(`❌ Friends menu error:`, error);
      return `Eish, couldn't load friends menu. Try "menu"! 🔄`;
    }
  }

  async showSettingsMenu(user) {
    try {
      await updateUser(user.id, {
        current_menu: 'settings_menu',
        expecting_input: null,
        last_active_at: new Date().toISOString()
      });
      return MESSAGES.MENUS.SETTINGS;
    } catch (error) {
      console.error(`❌ Settings menu error:`, error);
      return `Eish, couldn't load settings. Try "menu"! 🔄`;
    }
  }

  async promptAddFriend(user) {
    try {
      await updateUser(user.id, {
        current_menu: null,
        expecting_input: 'username_for_friend',
        last_active_at: new Date().toISOString()
      });

      return MESSAGES.FRIENDS.ADD_PROMPT;
    } catch (error) {
      console.error(`❌ Add friend prompt error:`, error);
      return `Eish, couldn't start friend adding. Try "menu"! 🔄`;
    }
  }

  async promptChallengeFriend(user) {
    try {
      await updateUser(user.id, {
        current_menu: null,
        expecting_input: 'username_for_challenge',
        last_active_at: new Date().toISOString()
      });

      return MESSAGES.FRIENDS.CHALLENGE_PROMPT;
    } catch (error) {
      console.error(`❌ Challenge prompt error:`, error);
      return `Eish, couldn't start challenge. Try "menu"! 🔄`;
    }
  }

  handleInvalidOption(menuType) {
    const menuNames = {
      main: 'main menu',
      subject: 'subject menu',
      friends: 'friends menu',
      settings: 'settings menu',
      math_topics: 'math topics menu',
      post_answer: 'post-answer menu'
    };

    const menuName = menuNames[menuType] || 'menu';
    return `Eish, that's not a valid option for the ${menuName}! 📱\n\nType "menu" to see your options again! 🎯`;
  }
}

export const menuHandler = new MenuHandler();
