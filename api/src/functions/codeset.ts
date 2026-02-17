import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { executeStoredProcedure, createErrorResponse } from '../lib/azuresql'

interface CodeSetRequest {
  concept_ids: number[]
  combo_filter?: 'ALL' | 'SINGLE' | 'COMBINATION'
  build_type?: 'hierarchical' | 'direct' | 'labtest'
}

interface CodeSetResult {
  root_concept_name: string
  child_vocabulary_id: string
  child_code: string
  child_name: string
  child_concept_id: number
  concept_class_id: string
  combinationyesno?: string
  dose_form?: string
  dfg_name?: string
  concept_attribute?: string
  value?: string
  relationships_json?: string | null
  relationships?: Array<{ relationship_id: string; value_name: string }>
}

function deduplicateResults(results: CodeSetResult[]): CodeSetResult[] {
  const seen = new Map<string, CodeSetResult>()
  for (const result of results) {
    const key = `${result.child_vocabulary_id}|${result.child_code}|${result.child_name}|${result.child_concept_id}|${result.concept_class_id}`
    if (!seen.has(key)) seen.set(key, result)
  }
  return Array.from(seen.values())
}

app.http('codeset', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'codeset',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const { concept_ids, combo_filter = 'ALL', build_type = 'hierarchical' } = await req.json() as CodeSetRequest

      if (!concept_ids || !Array.isArray(concept_ids) || concept_ids.length === 0) {
        return { status: 400, jsonBody: { success: false, error: 'At least one concept ID is required' } }
      }

      const tvpRows = concept_ids.map(id => [id])
      const allResults: CodeSetResult[] = []

      if (build_type === 'labtest') {
        const startTime = Date.now()
        console.log(`🧪 Lab Test Build: Starting for ${concept_ids.length} concepts`)
        const results = await executeStoredProcedure<CodeSetResult>(
          'dbo.sp_BuildCodeSet_LabTest',
          {},
          { name: 'ConceptIds', typeName: 'dbo.ConceptIdList', rows: tvpRows }
        )
        const parsedResults = results.map(r => ({
          ...r,
          relationships: r.relationships_json ? JSON.parse(r.relationships_json) : [],
        }))
        allResults.push(...parsedResults)
        console.log(`✅ Lab Test Build: Completed in ${Date.now() - startTime}ms - ${results.length} results`)
        const deduped = deduplicateResults(allResults)
        return { jsonBody: { success: true, data: deduped } }
      }

      if (build_type === 'direct') {
        const startTime = Date.now()
        console.log(`🚀 Direct Build: Starting for ${concept_ids.length} concepts`)
        const results = await executeStoredProcedure<CodeSetResult>(
          'dbo.sp_BuildCodeSet_Direct',
          {},
          { name: 'ConceptIds', typeName: 'dbo.ConceptIdList', rows: tvpRows }
        )
        allResults.push(...results)
        console.log(`✅ Direct Build: Completed in ${Date.now() - startTime}ms - ${results.length} results`)
        const deduped = deduplicateResults(allResults)
        return { jsonBody: { success: true, data: deduped } }
      }

      // Hierarchical build
      const startTime = Date.now()
      console.log(`🚀 Hierarchical Build: Using stored procedure for ${concept_ids.length} concepts`)
      const results = await executeStoredProcedure<CodeSetResult>(
        'dbo.sp_BuildCodeSet_Hierarchical',
        { ComboFilter: combo_filter },
        { name: 'ConceptIds', typeName: 'dbo.ConceptIdList', rows: tvpRows }
      )
      allResults.push(...results)
      console.log(`✅ Hierarchical Build: Completed in ${Date.now() - startTime}ms - ${results.length} results`)
      const deduped = deduplicateResults(allResults)
      return { jsonBody: { success: true, data: deduped } }
    } catch (err: any) {
      console.error('Code set API error:', err)
      return { status: 500, jsonBody: { success: false, error: err.message } }
    }
  },
})
