import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { executeStoredProcedure, createErrorResponse, createSuccessResponse } from '../lib/azuresql'
import { requireAuth } from '../lib/auth'

interface SaveCodeSetRequest {
  code_set_name: string
  description?: string
  concepts: any[]
  total_concepts?: number
  source_type: 'OMOP' | 'UMLS'
  source_metadata?: string
  build_type?: 'hierarchical' | 'direct' | 'labtest'
  anchor_concept_ids?: number[]
  build_parameters?: { combo_filter?: 'ALL' | 'SINGLE' | 'COMBINATION'; domain_id?: string }
}

app.http('user-codesets', {
  methods: ['GET', 'POST', 'DELETE'],
  authLevel: 'anonymous',
  route: 'user/codesets',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    console.log('=== Code Sets API called ===', req.method, req.url)
    try {
      const principal = requireAuth(req)

      if (req.method === 'POST') {
        const {
          code_set_name, description, concepts, total_concepts: providedTotal,
          source_type, source_metadata, build_type, anchor_concept_ids, build_parameters,
        } = await req.json() as SaveCodeSetRequest

        if (!code_set_name || !concepts || concepts.length === 0) {
          return { status: 400, jsonBody: createErrorResponse('Code set name and concepts are required', 400) }
        }
        if (!source_type || (source_type !== 'OMOP' && source_type !== 'UMLS')) {
          return { status: 400, jsonBody: createErrorResponse('Valid source_type is required (OMOP or UMLS)', 400) }
        }

        const totalConcepts = providedTotal || concepts.length
        const LARGE_THRESHOLD = 500
        const isLarge = totalConcepts >= LARGE_THRESHOLD
        const isMaterialized = !isLarge

        let conceptsJson: string
        let anchorConceptsJson: string | null = null
        let buildParamsJson: string | null = null

        if (isLarge) {
          if (!anchor_concept_ids || anchor_concept_ids.length === 0) {
            return { status: 400, jsonBody: createErrorResponse('anchor_concept_ids required for large code sets', 400) }
          }
          if (!build_type) {
            return { status: 400, jsonBody: createErrorResponse('build_type required for large code sets', 400) }
          }
          conceptsJson = JSON.stringify(concepts)
          anchorConceptsJson = JSON.stringify(anchor_concept_ids)
          buildParamsJson = JSON.stringify(build_parameters || {})
        } else {
          conceptsJson = JSON.stringify(concepts)
        }

        const result = await executeStoredProcedure<{ id: number }>('dbo.sp_SaveCodeSet', {
          user_id: principal.userId,
          code_set_name,
          description: description || null,
          concepts: conceptsJson,
          total_concepts: totalConcepts,
          source_type,
          source_metadata: source_metadata || null,
          build_type: build_type || null,
          anchor_concepts: anchorConceptsJson,
          build_parameters: buildParamsJson,
          is_materialized: isMaterialized,
        })

        const id = result[0].id
        console.log(`✅ Code set saved: ${id} with ${totalConcepts} concepts`)
        return { jsonBody: createSuccessResponse({ id }) }
      }

      if (req.method === 'GET') {
        const codeSetId = req.query.get('codeSetId')

        if (codeSetId) {
          // Get detail
          const result = await executeStoredProcedure('dbo.sp_GetCodeSetDetail', {
            id: parseInt(codeSetId),
            user_id: principal.userId,
          })

          if (result.length === 0) {
            return { status: 404, jsonBody: createErrorResponse('Code set not found', 404) }
          }

          const codeSet: any = result[0]
          const response = {
            ...codeSet,
            concepts: codeSet.concepts ? JSON.parse(codeSet.concepts) : [],
            anchor_concept_ids: codeSet.anchor_concepts ? JSON.parse(codeSet.anchor_concepts) : null,
            build_parameters: codeSet.build_parameters ? JSON.parse(codeSet.build_parameters) : null,
          }
          return { jsonBody: createSuccessResponse(response) }
        }

        // Get list
        const result = await executeStoredProcedure('dbo.sp_GetUserCodeSets', {
          user_id: principal.userId,
        })
        console.log('✅ Retrieved', result.length, 'code sets for user:', principal.userId)
        return { jsonBody: createSuccessResponse(result) }
      }

      if (req.method === 'DELETE') {
        const codeSetId = req.query.get('codeSetId')
        if (!codeSetId) {
          return { status: 400, jsonBody: createErrorResponse('Code set ID is required', 400) }
        }

        const result = await executeStoredProcedure<{ rows_affected: number; deleted: number }>('dbo.sp_DeleteCodeSet', {
          id: parseInt(codeSetId),
          user_id: principal.userId,
        })

        if (result.length === 0 || result[0].deleted === 0) {
          return { status: 404, jsonBody: createErrorResponse('Code set not found', 404) }
        }

        console.log('✅ Code set deleted:', codeSetId)
        return { jsonBody: createSuccessResponse({ deleted: true }) }
      }

      return { status: 405, jsonBody: createErrorResponse('Method not allowed', 405) }
    } catch (err: any) {
      if (err.message === 'Unauthorized') return { status: 401, jsonBody: createErrorResponse('Unauthorized', 401) }
      console.error('Code sets API error:', err)
      return { status: 500, jsonBody: createErrorResponse(err.message, 500) }
    }
  },
})
