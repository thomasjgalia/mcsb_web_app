import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { executeQuery, createErrorResponse } from '../lib/azuresql'

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async (_req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    console.log('=== Health Check API called ===')
    try {
      const startTime = Date.now()
      await executeQuery('SELECT 1 AS test')
      const duration = Date.now() - startTime
      console.log(`✅ Health check passed in ${duration}ms`)
      return {
        jsonBody: {
          success: true,
          message: 'Database connection established',
          duration_ms: duration,
          timestamp: new Date().toISOString(),
        },
      }
    } catch (err: any) {
      console.error('Health check failed:', err)
      return {
        status: 503,
        jsonBody: createErrorResponse(err.message, 503),
      }
    }
  },
})
