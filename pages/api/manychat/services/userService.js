import { executeQuery } from '../config/database.js';
import { CONSTANTS } from '../config/constants.js';

export async function findOrCreateUser(subscriberId) {
  return executeQuery(async (supabase) => {
    // Try to find existing user
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('whatsapp_psid', subscriberId)
      .maybeSingle();

    if (error) throw error;
    if (user) return user;

    // Create new user with basic info
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        whatsapp_psid: subscriberId,
        current_question_id: null,
        correct_answer_rate: 0.5,
        streak_count: 0,
        total_questions_answered: 0,
        total_correct_answers: 0,
        last_active_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (insertError) throw insertError;
    return newUser;
  });
}

export async function updateUser(userId, updates) {
  return executeQuery(async (supabase) => {
    // CRITICAL FIX: Remove expecting_input_type from updates
    const { expecting_input_type, ...safeUpdates } = updates;

    const { data, error } = await supabase
      .from('users')
      .update({
        ...safeUpdates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  });
}

export async function isUserRegistrationComplete(user) {
  return (
    user.username && user.grade && user.preferred_subjects && user.preferred_subjects.length > 0
  );
}

export async function getUserRegistrationState(user) {
  if (!user.username) return CONSTANTS.REGISTRATION_STATES.NEEDS_USERNAME;
  if (!user.grade) return CONSTANTS.REGISTRATION_STATES.NEEDS_GRADE;
  if (!user.preferred_subjects || user.preferred_subjects.length === 0) {
    return CONSTANTS.REGISTRATION_STATES.NEEDS_SUBJECTS;
  }
  return CONSTANTS.REGISTRATION_STATES.COMPLETE;
}

export async function generateFriendCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'GOAT';

  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
}

export async function isUsernameAvailable(username) {
  return executeQuery(async (supabase) => {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (error) throw error;
    return !data; // Available if no user found
  });
}

export async function updateUserActivity(userId) {
  return executeQuery(async (supabase) => {
    const { error } = await supabase
      .from('users')
      .update({
        last_active_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) throw error;
  });
}

export async function updateUserStats(userId, isCorrect, newStreak) {
  return executeQuery(async (supabase) => {
    const { data: user } = await supabase
      .from('users')
      .select('total_questions_answered, total_correct_answers, correct_answer_rate')
      .eq('id', userId)
      .single();

    const newTotal = (user.total_questions_answered || 0) + 1;
    const newCorrect = (user.total_correct_answers || 0) + (isCorrect ? 1 : 0);

    // Update rate using EMA (4:1 weighting)
    const oldRate = user.correct_answer_rate || 0.5;
    const newRate = (oldRate * 4 + (isCorrect ? 1 : 0)) / 5;

    const { error } = await supabase
      .from('users')
      .update({
        total_questions_answered: newTotal,
        total_correct_answers: newCorrect,
        correct_answer_rate: newRate,
        streak_count: newStreak,
        last_active_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) throw error;

    return { newRate, newTotal, newCorrect };
  });
}
