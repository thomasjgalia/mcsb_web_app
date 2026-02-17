import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { executeQuery, createErrorResponse } from '../lib/azuresql'

interface LabTestPanelSearchRequest {
  labTestConceptIds: number[]
}

interface LabTestPanelSearchResult {
  lab_test_type: string
  std_concept_id: number
  panel_concept_id: number
  search_result: string
  searched_code: string
  searched_concept_class_id: string
  vocabulary_id: string
  property: null
  scale: null
  system: null
  time: null
}

app.http('labtest-panel-search', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'labtest-panel-search',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    console.log('=== Lab Test Panel Search API called ===')
    try {
      const { labTestConceptIds } = await req.json() as LabTestPanelSearchRequest

      if (!labTestConceptIds || !Array.isArray(labTestConceptIds) || labTestConceptIds.length === 0) {
        return { status: 400, jsonBody: createErrorResponse('labTestConceptIds array is required', 400) }
      }

      const sql = `
        WITH selected_tests AS (
          SELECT
            CAST(value AS INT) AS std_concept_id,
            CONCEPT_NAME,
            CONCEPT_CODE,
            CONCEPT_CLASS_ID,
            VOCABULARY_ID,
            'Lab Test' AS lab_test_type
          FROM STRING_SPLIT(@labTestIds, ',')
          INNER JOIN CONCEPT c ON c.CONCEPT_ID = CAST(value AS INT)
        ),
        panels AS (
          SELECT
            'Panel'               AS lab_test_type,
            st.std_concept_id     AS std_concept_id,
            c.CONCEPT_ID          AS panel_concept_id,
            c.CONCEPT_NAME        AS search_result,
            c.CONCEPT_CODE        AS searched_code,
            c.CONCEPT_CLASS_ID    AS searched_concept_class_id,
            c.VOCABULARY_ID       AS vocabulary_id,
            NULL                  AS property,
            NULL                  AS scale,
            NULL                  AS system,
            NULL                  AS time
          FROM selected_tests st
          INNER JOIN CONCEPT_RELATIONSHIP cr
            ON cr.CONCEPT_ID_2 = st.std_concept_id
            AND cr.RELATIONSHIP_ID = 'Contained in panel'
            AND COALESCE(cr.INVALID_REASON, '') = ''
            INNER JOIN CONCEPT c on c.concept_id = cr.concept_id_1
        )
        SELECT
          lab_test_type,
          std_concept_id,
          std_concept_id        AS panel_concept_id,
          CONCEPT_NAME          AS search_result,
          CONCEPT_CODE          AS searched_code,
          CONCEPT_CLASS_ID      AS searched_concept_class_id,
          VOCABULARY_ID         AS vocabulary_id,
          NULL                  AS property,
          NULL                  AS scale,
          NULL                  AS system,
          NULL                  AS time
        FROM selected_tests
        WHERE EXISTS (SELECT 1 FROM panels)

        UNION ALL

        SELECT * FROM panels

        ORDER BY std_concept_id ASC, lab_test_type ASC, searched_code ASC
      `

      const labTestIds = labTestConceptIds.join(',')
      const results = await executeQuery<LabTestPanelSearchResult>(sql, { labTestIds })

      console.log('📤 Sending lab test panel search response with', results.length, 'results')
      return { jsonBody: { success: true, data: results } }
    } catch (err: any) {
      console.error('Lab Test Panel Search API error:', err)
      return { status: 500, jsonBody: { success: false, error: err.message } }
    }
  },
})
