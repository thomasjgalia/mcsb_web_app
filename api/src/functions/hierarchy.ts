import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { executeStoredProcedure } from '../lib/azuresql'

interface HierarchyRequest {
  concept_id: number
}

interface HierarchyResult {
  steps_away: number
  concept_name: string
  hierarchy_concept_id: number
  concept_code: string
  vocabulary_id: string
  concept_class_id: string
  root_term: string
}

app.http('hierarchy', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'hierarchy',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const { concept_id: rawConceptId } = await req.json() as HierarchyRequest
      const concept_id = typeof rawConceptId === 'string' ? parseInt(rawConceptId, 10) : rawConceptId

      if (!concept_id || typeof concept_id !== 'number' || isNaN(concept_id)) {
        return { status: 400, jsonBody: { success: false, error: 'Valid concept ID is required' } }
      }

      const results = await executeStoredProcedure<HierarchyResult>('dbo.sp_GetConceptHierarchy', { ConceptId: concept_id })
      return { jsonBody: { success: true, data: results } }
    } catch (err: any) {
      console.error('Hierarchy API error:', err)
      return { status: 500, jsonBody: { success: false, error: err.message } }
    }
  },
})
