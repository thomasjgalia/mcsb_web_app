import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { createErrorResponse, createSuccessResponse } from '../lib/azuresql'
import { requireAuth } from '../lib/auth'
import sql from 'mssql'

interface UserProfile {
  user_id: string
  email: string
  display_name?: string
  preferences?: string
  created_at: string
  updated_at: string
}

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

app.http('user-profile', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'user/profile',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    console.log('=== User Profile API called ===', req.method)
    try {
      const principal = requireAuth(req)

      if (req.method === 'POST') {
        const { email, display_name, preferences } = await req.json() as any

        if (!email) {
          return { status: 400, jsonBody: createErrorResponse('Email is required', 400) }
        }

        const pool = await getPool()
        const request = pool.request()

        const query = `
          MERGE user_profiles AS target
          USING (SELECT @user_id AS id) AS source
          ON target.user_id = source.id
          WHEN MATCHED THEN
            UPDATE SET email = @email, display_name = @display_name, preferences = @preferences, updated_at = GETDATE()
          WHEN NOT MATCHED THEN
            INSERT (user_id, email, display_name, preferences)
            VALUES (@user_id, @email, @display_name, @preferences);

          SELECT * FROM user_profiles WHERE user_id = @user_id;
        `

        request.input('user_id',      sql.NVarChar(128), principal.userId)
        request.input('email',        sql.NVarChar(255), email)
        request.input('display_name', sql.NVarChar(100), display_name || null)
        request.input('preferences',  sql.NVarChar(sql.MAX), preferences || null)

        const result = await request.query(query)
        const profile = result.recordset[0] as UserProfile
        console.log('✅ User profile upserted:', principal.userId)
        return { jsonBody: createSuccessResponse(profile) }
      }

      if (req.method === 'GET') {
        const pool = await getPool()
        const request = pool.request()

        request.input('user_id', sql.NVarChar(128), principal.userId)
        const result = await request.query('SELECT * FROM user_profiles WHERE user_id = @user_id')

        if (result.recordset.length === 0) {
          return { status: 404, jsonBody: createErrorResponse('User profile not found', 404) }
        }

        return { jsonBody: createSuccessResponse(result.recordset[0] as UserProfile) }
      }

      return { status: 405, jsonBody: createErrorResponse('Method not allowed', 405) }
    } catch (err: any) {
      if (err.message === 'Unauthorized') return { status: 401, jsonBody: createErrorResponse('Unauthorized', 401) }
      console.error('User profile API error:', err)
      return { status: 500, jsonBody: createErrorResponse(err.message, 500) }
    }
  },
})
