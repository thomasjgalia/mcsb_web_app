// ============================================================================
// Supabase Client Configuration
// ============================================================================
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// ============================================================================
// Authentication Helper Functions
// ============================================================================

/**
 * Send magic link email for passwordless authentication
 */
export const signInWithMagicLink = async (email: string) => {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
    },
  });

  return { data, error };
};

/**
 * Sign out current user
 */
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

/**
 * Get current user session
 */
export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error };
};

/**
 * Get current user
 */
export const getUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  return { user: data.user, error };
};

// ============================================================================
// User Data Helper Functions
// ============================================================================

/**
 * Save user preferences
 */
export const saveUserPreferences = async (preferences: {
  default_domain?: string;
  theme?: string;
}) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: user.id,
      ...preferences,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  return { data, error };
};

/**
 * Get user preferences
 */
export const getUserPreferences = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: null };

  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return { data, error };
};

/**
 * Save a code set
 */
export const saveCodeSet = async (name: string, hierarchyConceptIds: number[]) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('saved_code_sets')
    .insert({
      user_id: user.id,
      name,
      hierarchy_concept_ids: hierarchyConceptIds,
    })
    .select()
    .single();

  return { data, error };
};

/**
 * Get all saved code sets for current user
 */
export const getSavedCodeSets = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: null };

  const { data, error } = await supabase
    .from('saved_code_sets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return { data: data || [], error };
};

/**
 * Delete a saved code set
 */
export const deleteCodeSet = async (id: string) => {
  const { error } = await supabase
    .from('saved_code_sets')
    .delete()
    .eq('id', id);

  return { error };
};

/**
 * Add search to history
 */
export const addSearchHistory = async (searchTerm: string, domain: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: null };

  const { data, error } = await supabase
    .from('search_history')
    .insert({
      user_id: user.id,
      search_term: searchTerm,
      domain,
    })
    .select()
    .single();

  return { data, error };
};

/**
 * Get recent search history
 */
export const getSearchHistory = async (limit = 10) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: null };

  const { data, error } = await supabase
    .from('search_history')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  return { data: data || [], error };
};
