// ============================================================================
// Supabase JWT Token Verification
// ============================================================================
// Verifies Supabase JWT tokens sent from the frontend
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';

let supabase: SupabaseClient | null = null;

// Lazy initialization of Supabase client
function getSupabaseClient() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL environment variable is required');
    }
    if (!supabaseServiceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabase;
}

interface SupabaseUser {
  id: string;
  email?: string;
}

/**
 * Verify Supabase JWT token from request headers
 * Returns user if valid, null if invalid
 */
export async function verifySupabaseToken(
  req: VercelRequest
): Promise<SupabaseUser | null> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('No authorization header found');
    return null;
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.getUser(token);

    if (error || !data.user) {
      console.warn('Invalid token:', error?.message);
      return null;
    }

    return {
      id: data.user.id,
      email: data.user.email,
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}
