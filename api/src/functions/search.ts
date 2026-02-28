import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { executeStoredProcedure, createErrorResponse } from '../lib/azuresql'

interface SearchRequest {
  searchterm: string
  domain_id: string
}

interface SearchResult {
  standard_name: string
  std_concept_id: number
  standard_code: string
  standard_vocabulary: string
  concept_class_id: string
  search_result: string
  searched_concept_id: number
  searched_code: string
  searched_vocabulary: string
  searched_concept_class_id: string
  searched_term: string
}

app.http('search', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'search',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    console.log('=== Search API called ===')
    try {
      const apiStartTime = Date.now()
      const { searchterm, domain_id } = await req.json() as SearchRequest
      console.log('Search params:', { searchterm, domain_id })

      if (!searchterm || searchterm.trim().length < 2) {
        return { status: 400, jsonBody: createErrorResponse('Search term must be at least 2 characters', 400) }
      }
      if (!domain_id) {
        return { status: 400, jsonBody: createErrorResponse('Domain ID is required', 400) }
      }

      const results = await executeStoredProcedure<SearchResult>('dbo.sp_SearchConcepts', {
        SearchTerm: searchterm.trim(),
        DomainId: domain_id,
      })

      console.log('📤 Sending response with', results.length, 'results')
      console.log(`⏱️  TOTAL API TIME: ${Date.now() - apiStartTime}ms`)
      return { jsonBody: { success: true, data: results } }
    } catch (err: any) {
      console.error('Search API error:', err)
      return { status: 500, jsonBody: { success: false, error: err.message } }
    }
  },
})
