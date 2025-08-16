// In getOrCreateActiveTherapySession function, fix the default value:

async function getOrCreateActiveTherapySession(userId) {
  return await executeQuery(async (supabase) => {
    const { data: existing } = await supabase
      .from('therapy_sessions')
      .select('*')
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) return existing;

    const { data: created, error } = await supabase
      .from('therapy_sessions')
      .insert({
        user_id: userId,
        reason: 'other',
        pre_confidence: 3, // FIX: Valid default value (1-5 range)
        session_state: { step: 'ask_reason' }
      })
      .select('*')
      .single();
    if (error) throw error;
    return created;
  });
}
