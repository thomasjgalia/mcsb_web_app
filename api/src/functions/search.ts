import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { executeQuery, executeStoredProcedure, createErrorResponse } from '../lib/azuresql'

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

      const useStoredProcs = process.env.USE_STORED_PROCEDURES === 'true'
      let results: SearchResult[] = []

      if (useStoredProcs) {
        console.log('🚀 Search: Using stored procedure')
        try {
          results = await executeStoredProcedure<SearchResult>('dbo.sp_SearchConcepts', {
            SearchTerm: searchterm.trim(),
            DomainId: domain_id,
          })
        } catch (error) {
          console.error('Stored procedure failed, falling back to dynamic queries:', error)
        }
      }

      if (!useStoredProcs || results.length === 0) {
        console.log('🔄 Search: Using dynamic queries')
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
          WITH hits AS (
            SELECT
              c.concept_id,
              c.concept_name,
              c.concept_code,
              c.vocabulary_id,
              c.domain_id,
              c.concept_class_id,
              c.standard_concept,
              c.invalid_reason,
              CASE WHEN TRY_CAST(@searchterm AS BIGINT) = c.concept_id THEN 1 ELSE 0 END AS is_exact_id_match,
              CASE WHEN c.concept_code = @searchterm THEN 1 ELSE 0 END AS is_exact_code_match,
              ABS(LEN(@searchterm) - LEN(c.concept_name)) AS name_length_delta
            FROM concept c
            WHERE
              UPPER(CAST(c.concept_id AS NVARCHAR(30)) + ' ' + c.concept_code + ' ' + c.concept_name)
                LIKE '%' + UPPER(@searchterm) + '%'
              AND c.domain_id = @domain_id
              AND c.vocabulary_id IN ${vocabularyList}
              AND (
                   c.domain_id <> 'Drug'
                OR c.concept_class_id IN (
                     'Clinical Drug','Branded Drug','Ingredient','Clinical Pack','Branded Pack',
                     'Quant Clinical Drug','Quant Branded Drug','11-digit NDC',
                     'ATC 1st','ATC 2nd','ATC 3rd','ATC 4th','ATC 5th'
                   )
                OR c.vocabulary_id = 'ATC'
              )
              AND (c.invalid_reason IS NULL OR c.invalid_reason = '')
          ),
          mapped AS (
            SELECT
              h.*,
              cr.relationship_id,
              s.concept_id       AS s_concept_id,
              s.concept_name     AS s_concept_name,
              s.concept_code     AS s_concept_code,
              s.vocabulary_id    AS s_vocabulary_id,
              s.concept_class_id AS s_concept_class_id,
              s.standard_concept AS s_standard_concept
            FROM hits h
            LEFT JOIN concept_relationship cr
              ON cr.concept_id_1 = h.concept_id
             AND cr.relationship_id = 'Maps to'
            LEFT JOIN concept s
              ON s.concept_id = cr.concept_id_2
             AND s.standard_concept = 'S'
          )
          SELECT TOP 1000
            COALESCE(s_concept_name, CASE WHEN standard_concept = 'S' THEN concept_name END, concept_name) AS standard_name,
            COALESCE(s_concept_id,   CASE WHEN standard_concept = 'S' THEN concept_id   END, concept_id)   AS std_concept_id,
            COALESCE(s_concept_code, CASE WHEN standard_concept = 'S' THEN concept_code END, concept_code) AS standard_code,
            COALESCE(s_vocabulary_id,    CASE WHEN standard_concept = 'S' THEN vocabulary_id    END, vocabulary_id)    AS standard_vocabulary,
            COALESCE(s_concept_class_id, CASE WHEN standard_concept = 'S' THEN concept_class_id END, concept_class_id) AS concept_class_id,
            concept_name         AS search_result,
            concept_id           AS searched_concept_id,
            concept_code         AS searched_code,
            vocabulary_id        AS searched_vocabulary,
            concept_class_id     AS searched_concept_class_id,
            CAST(concept_id AS NVARCHAR(30)) + ' ' + concept_code + ' ' + concept_name AS searched_term
          FROM mapped
          ORDER BY
            CASE WHEN is_exact_id_match = 1 THEN 0 ELSE 1 END,
            CASE WHEN is_exact_code_match = 1 THEN 0 ELSE 1 END,
            CASE
              WHEN s_concept_id IS NOT NULL THEN 0
              WHEN standard_concept = 'S'    THEN 1
              ELSE 2
            END,
            name_length_delta,
            concept_name
        `

        results = await executeQuery<SearchResult>(sql, {
          searchterm: searchterm.trim(),
          domain_id,
        })
      }

      console.log('📤 Sending response with', results.length, 'results')
      console.log(`⏱️  TOTAL API TIME: ${Date.now() - apiStartTime}ms`)
      return { jsonBody: { success: true, data: results } }
    } catch (err: any) {
      console.error('Search API error:', err)
      return { status: 500, jsonBody: { success: false, error: err.message } }
    }
  },
})
