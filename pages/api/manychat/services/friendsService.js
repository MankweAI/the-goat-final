import { executeQuery } from '../config/database.js';

export class FriendsService {
  async addFriendByUsername(userId, friendUsername) {
    return executeQuery(async (supabase) => {
      // Find friend by username
      const { data: friend, error } = await supabase
        .from('users')
        .select('id, username, display_name')
        .eq('username', friendUsername.toLowerCase())
        .maybeSingle();

      if (error) throw error;

      if (!friend) {
        return {
          success: false,
          message: `Username @${friendUsername} not found! 🔍\n\nMake sure they're registered with The GOAT!`
        };
      }

      if (friend.id === userId) {
        return {
          success: false,
          message: `You can't add yourself as a friend, sharp! 😄\n\nType "menu" for other options!`
        };
      }

      // Check if already friends
      const { data: existing } = await supabase
        .from('friendships')
        .select('id')
        .or(
          `and(user_id_1.eq.${userId},user_id_2.eq.${friend.id}),and(user_id_1.eq.${friend.id},user_id_2.eq.${userId})`
        )
        .maybeSingle();

      if (existing) {
        return {
          success: false,
          message: `You and @${friend.username} are already friends! 🤝\n\nType "menu" to explore other options!`
        };
      }

      // Add friendship
      await supabase.from('friendships').insert({
        user_id_1: Math.min(userId, friend.id),
        user_id_2: Math.max(userId, friend.id),
        friend_username: friend.username,
        friend_display_name: friend.display_name,
        status: 'active',
        initiated_by: userId
      });

      return {
        success: true,
        message: `Sharp! @${friend.username} (${friend.display_name}) is now your friend! 🔥\n\nType "menu" → "4" → "3" to challenge them! 💪`
      };
    });
  }

  async getUserFriends(userId) {
    return executeQuery(async (supabase) => {
      const { data: friendships, error } = await supabase
        .from('friendships')
        .select(
          `
          friend_username,
          friend_display_name,
          users!friendships_user_id_1_fkey(id, username, display_name, streak_count),
          users!friendships_user_id_2_fkey(id, username, display_name, streak_count)
        `
        )
        .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
        .eq('status', 'active');

      if (error) throw error;

      if (!friendships || friendships.length === 0) {
        return {
          count: 0,
          message: `No friends yet! 👥\n\nType "menu" → "4" → "2" to add friends by username! 🤝`
        };
      }

      let friendsList = `👥 YOUR STUDY SQUAD (${friendships.length}):\n\n`;

      friendships.forEach((friendship, index) => {
        const friend = friendship.users_1?.id === userId ? friendship.users_2 : friendship.users_1;

        friendsList += `${index + 1}. @${friend.username}\n`;
        friendsList += `   ${friend.display_name}\n`;
        friendsList += `   Streak: ${friend.streak_count || 0} 🔥\n\n`;
      });

      friendsList += `Type "menu" → "4" → "3" to challenge someone! ⚔️`;

      return {
        count: friendships.length,
        message: friendsList
      };
    });
  }

  async getSocialStats(userId) {
    return executeQuery(async (supabase) => {
      // Get friend count
      const { count: friendCount } = await supabase
        .from('friendships')
        .select('id', { count: 'exact' })
        .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
        .eq('status', 'active');

      // Get challenge stats (placeholder for future)
      const challengesWon = 0;
      const challengesPlayed = 0;

      return (
        `📊 YOUR SOCIAL STATS\n\n` +
        `👥 Friends: ${friendCount || 0}\n` +
        `⚔️ Challenges Won: ${challengesWon}\n` +
        `🎯 Challenges Played: ${challengesPlayed}\n` +
        `🏆 Win Rate: ${challengesPlayed > 0 ? Math.round((challengesWon / challengesPlayed) * 100) : 0}%\n\n` +
        `Type "menu" for more options! 🚀`
      );
    });
  }
}

export const friendsService = new FriendsService();

