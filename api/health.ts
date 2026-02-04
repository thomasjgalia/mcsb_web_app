// ============================================================================
// API Endpoint: Health Check / Database Warmup
// ============================================================================
// Vercel Serverless Function
// Endpoint: GET /api/health
// Purpose: Wake up Azure SQL database and verify connection
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { executeQuery, createErrorResponse } from './lib/azuresql.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== Health Check API called ===');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  // Only accept GET requests
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  try {
    const startTime = Date.now();

    // Simple query to wake up the database
    await executeQuery('SELECT 1 AS test');

    const duration = Date.now() - startTime;

    console.log(`✅ Health check passed in ${duration}ms`);

    return res.status(200).json({
      success: true,
      message: 'Database connection established',
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check failed:', error);
    const message = error instanceof Error ? error.message : 'Health check failed';
    return res.status(503).json({
      success: false,
      error: message,
      code: 503,
    });
  }
}
