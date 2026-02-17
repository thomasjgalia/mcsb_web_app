import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { executeQuery, executeStoredProcedure, createErrorResponse } from '../lib/azuresql'

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

      const useStoredProcs = process.env.USE_STORED_PROCEDURES === 'true'

      if (useStoredProcs) {
        console.log('🚀 Hierarchy: Using stored procedure')
        try {
          const results = await executeStoredProcedure<HierarchyResult>('dbo.sp_GetConceptHierarchy', { ConceptId: concept_id })
          return { jsonBody: { success: true, data: results } }
        } catch (error) {
          console.error('❌ Stored procedure failed, falling back to dynamic queries:', error)
        }
      }

      console.log('🔄 Hierarchy: Using dynamic queries')
      const domainResult = await executeQuery<{ domain_id: string }>(
        'SELECT domain_id FROM concept WHERE concept_id = @concept_id',
        { concept_id }
      )

      if (domainResult.length === 0) {
        return { status: 404, jsonBody: { success: false, error: 'Concept not found' } }
      }

      const domain_id = domainResult[0].domain_id
      let vocabularyList: string
      switch (domain_id) {
        case 'Condition':   vocabularyList = "('ICD10CM','SNOMED','ICD9CM')"; break
        case 'Observation': vocabularyList = "('ICD10CM','SNOMED','LOINC','CPT4','HCPCS')"; break
        case 'Drug':        vocabularyList = "('RxNorm','NDC','CPT4','CVX','HCPCS','ATC')"; break
        case 'Measurement': vocabularyList = "('LOINC','CPT4','SNOMED','HCPCS')"; break
        case 'Procedure':   vocabularyList = "('CPT4','HCPCS','SNOMED','ICD09PCS','LOINC','ICD10PCS')"; break
        default:            vocabularyList = "('')"
      }

      const sql = `
        SELECT
          ca.min_levels_of_separation              AS steps_away,
          a.concept_name                           AS concept_name,
          a.concept_id                             AS hierarchy_concept_id,
          a.concept_code                           AS concept_code,
          a.vocabulary_id                          AS vocabulary_id,
          a.concept_class_id                       AS concept_class_id,
          c.concept_name                           AS root_term
        FROM concept c
        JOIN concept_ancestor ca ON ca.descendant_concept_id = c.concept_id
        JOIN concept a ON a.concept_id = ca.ancestor_concept_id
        WHERE
          c.concept_id = @concept_id
          AND a.vocabulary_id IN ${vocabularyList}
          AND (
               (@domain_id = 'Drug' AND (
                    (a.vocabulary_id = 'ATC'    AND a.concept_class_id IN ('ATC 5th','ATC 4th','ATC 3rd','ATC 2nd','ATC 1st'))
                 OR (a.vocabulary_id = 'RxNorm' AND a.concept_class_id IN ('Clinical Drug','Ingredient'))
               ))
            OR (@domain_id <> 'Drug')
          )

        UNION

        SELECT
          ca.min_levels_of_separation * -1         AS steps_away,
          a.concept_name                           AS concept_name,
          a.concept_id                             AS hierarchy_concept_id,
          a.concept_code                           AS concept_code,
          a.vocabulary_id                          AS vocabulary_id,
          a.concept_class_id                       AS concept_class_id,
          c.concept_name                           AS root_term
        FROM concept c
        JOIN concept_ancestor ca ON ca.ancestor_concept_id = c.concept_id
        JOIN concept a ON a.concept_id = ca.descendant_concept_id
        WHERE
          c.concept_id = @concept_id
          AND a.vocabulary_id IN ${vocabularyList}
          AND (
               (@domain_id = 'Drug' AND (
                    (a.vocabulary_id = 'ATC'    AND a.concept_class_id IN ('ATC 5th','ATC 4th','ATC 3rd','ATC 2nd','ATC 1st'))
                 OR (a.vocabulary_id = 'RxNorm' AND a.concept_class_id IN ('Clinical Drug','Ingredient'))
               ))
            OR (@domain_id <> 'Drug')
          )

        ORDER BY steps_away DESC
      `

      const results = await executeQuery<HierarchyResult>(sql, { concept_id, domain_id })
      return { jsonBody: { success: true, data: results } }
    } catch (err: any) {
      console.error('Hierarchy API error:', err)
      return { status: 500, jsonBody: { success: false, error: err.message } }
    }
  },
})
