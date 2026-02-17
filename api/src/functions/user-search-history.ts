import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { createErrorResponse, createSuccessResponse } from '../lib/azuresql'
import { requireAuth } from '../lib/auth'
import sql from 'mssql'

async function getPool() {
  const config: sql.config = {
    server: (process.env.AZURE_SQL_SERVER || '').trim(),
    database: (process.env.AZURE_SQL_DATABASE || '').trim(),
    user: (process.env.AZURE_SQL_USER || '').trim(),
    password: (process.env.AZURE_SQL_PASSWORD || '').trim(),
    options: { encrypt: true, trustServerCertificate: true, connectTimeout: 300000, requestTimeout: 300000 },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  }
  return sql.connect(config)
}

app.http('user-search-history', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'user/search-history',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    console.log('=== Search History API called ===', req.method)
    try {
      const principal = requireAuth(req)

      if (req.method === 'POST') {
        const { search_term, domain_type, result_count } = await req.json() as any

        if (!search_term) {
          return { status: 400, jsonBody: createErrorResponse('Search term is required', 400) }
        }

        try {
          const pool = await getPool()
          const request = pool.request()
          request.input('user_id',      sql.NVarChar(128), principal.userId)
          request.input('search_term',  sql.NVarChar(500), search_term)
          request.input('domain_type',  sql.NVarChar(50),  domain_type || null)
          request.input('result_count', sql.Int,           result_count || null)
          await request.query(`
            INSERT INTO search_history (user_id, search_term, domain_type, result_count)
            VALUES (@user_id, @search_term, @domain_type, @result_count)
          `)
          console.log('✅ Search tracked:', search_term)
          return { jsonBody: createSuccessResponse({ tracked: true }) }
        } catch {
          // Don't fail request for tracking failures
          return { jsonBody: createSuccessResponse({ tracked: false }) }
        }
      }

      if (req.method === 'GET') {
        const limitParam = req.query.get('limit')
        const limit = parseInt(limitParam || '10')

        if (isNaN(limit) || limit < 1 || limit > 100) {
          return { status: 400, jsonBody: createErrorResponse('Limit must be between 1 and 100', 400) }
        }

        const pool = await getPool()
        const request = pool.request()
        request.input('user_id', sql.NVarChar(128), principal.userId)
        request.input('limit',   sql.Int,           limit)

        const result = await request.query(`
          SELECT TOP (@limit) id, search_term, domain_type, result_count, searched_at
          FROM search_history
          WHERE user_id = @user_id
          ORDER BY searched_at DESC
        `)

        console.log('✅ Retrieved', result.recordset.length, 'search history records')
        return { jsonBody: createSuccessResponse(result.recordset) }
      }

      return { status: 405, jsonBody: createErrorResponse('Method not allowed', 405) }
    } catch (err: any) {
      if (err.message === 'Unauthorized') return { status: 401, jsonBody: createErrorResponse('Unauthorized', 401) }
      console.error('Search history API error:', err)
      return { status: 500, jsonBody: createErrorResponse(err.message, 500) }
    }
  },
})
