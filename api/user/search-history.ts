// ============================================================================
// API Endpoint: Search History Tracking
// ============================================================================
// Vercel Serverless Function
// Endpoints:
//   POST /api/user/search-history - Track a search
//   GET /api/user/search-history/:userId?limit=10 - Get recent searches
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createErrorResponse, createSuccessResponse } from '../lib/azuresql.js';
import { verifySupabaseToken } from '../lib/supabase-auth.js';
import sql from 'mssql';

interface TrackSearchRequest {
  supabase_user_id: string;
  search_term: string;
  domain_type?: string;
  result_count?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== Search History API called ===', req.method);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  try {
    // Verify Supabase JWT token
    const user = await verifySupabaseToken(req);
    if (!user) {
      return res.status(401).json(createErrorResponse('Unauthorized', 401));
    }

    if (req.method === 'POST') {
      return await handleTrackSearch(req, res, user.id);
    } else if (req.method === 'GET') {
      return await handleGetSearchHistory(req, res, user.id);
    } else {
      return res.status(405).json(createErrorResponse('Method not allowed', 405));
    }
  } catch (error) {
    console.error('Search history API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json(createErrorResponse(message, 500));
  }
}

/**
 * Track a search
 */
async function handleTrackSearch(
  req: VercelRequest,
  res: VercelResponse,
  authenticatedUserId: string
) {
  const {
    supabase_user_id,
    search_term,
    domain_type,
    result_count,
  } = req.body as TrackSearchRequest;

  // Verify user can only track their own searches
  if (supabase_user_id !== authenticatedUserId) {
    return res.status(403).json(createErrorResponse('Forbidden', 403));
  }

  if (!search_term) {
    return res.status(400).json(createErrorResponse('Search term is required', 400));
  }

  try {
    const pool = await sql.connect(process.env.AZURE_SQL_CONNECTION_STRING || '');
    const request = pool.request();

    const query = `
      INSERT INTO search_history
        (supabase_user_id, search_term, domain_type, result_count)
      VALUES
        (@supabase_user_id, @search_term, @domain_type, @result_count);
    `;

    request.input('supabase_user_id', sql.UniqueIdentifier, supabase_user_id);
    request.input('search_term', sql.NVarChar(500), search_term);
    request.input('domain_type', sql.NVarChar(50), domain_type || null);
    request.input('result_count', sql.Int, result_count || null);

    await request.query(query);

    console.log('✅ Search tracked:', search_term);
    return res.status(200).json(createSuccessResponse({ tracked: true }));
  } catch (error) {
    console.error('Failed to track search:', error);
    // Don't fail the request if tracking fails
    return res.status(200).json(createSuccessResponse({ tracked: false }));
  }
}

/**
 * Get user's search history
 */
async function handleGetSearchHistory(
  req: VercelRequest,
  res: VercelResponse,
  authenticatedUserId: string
) {
  const userId = req.query.userId as string;
  const limit = parseInt(req.query.limit as string) || 10;

  if (!userId) {
    return res.status(400).json(createErrorResponse('User ID is required', 400));
  }

  // Verify user can only access their own search history
  if (userId !== authenticatedUserId) {
    return res.status(403).json(createErrorResponse('Forbidden', 403));
  }

  if (limit < 1 || limit > 100) {
    return res.status(400).json(createErrorResponse('Limit must be between 1 and 100', 400));
  }

  try {
    const pool = await sql.connect(process.env.AZURE_SQL_CONNECTION_STRING || '');
    const request = pool.request();

    const query = `
      SELECT TOP (@limit)
        id,
        search_term,
        domain_type,
        result_count,
        searched_at
      FROM search_history
      WHERE supabase_user_id = @supabase_user_id
      ORDER BY searched_at DESC;
    `;

    request.input('supabase_user_id', sql.UniqueIdentifier, userId);
    request.input('limit', sql.Int, limit);

    const result = await request.query(query);

    console.log('✅ Retrieved', result.recordset.length, 'search history records');
    return res.status(200).json(createSuccessResponse(result.recordset));
  } catch (error) {
    console.error('Failed to get search history:', error);
    throw error;
  }
}
