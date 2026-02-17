import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { readFileSync } from 'fs'
import { join } from 'path'
import { executeQuery, createErrorResponse } from '../lib/azuresql'

interface LabTestSearchRequest {
  searchterm: string
}

interface LabTestSearchResult {
  lab_test_type: string
  std_concept_id: number
  search_result: string
  searched_code: string
  searched_concept_class_id: string
  vocabulary_id: string
  property: string | null
  scale: string | null
  system: string | null
  time: string | null
  panel_count: number
}

interface ScaleRollup { attribute: string; raw_value: string; canonical: string; label: string }
interface TimeRollup  { attribute: string; raw_value: string; time_bucket: string }
interface SystemRollup { attribute: string; raw_value: string; canonical: string; label: string }

let scaleRollups: ScaleRollup[] | null = null
let timeRollups: TimeRollup[] | null = null
let systemRollups: SystemRollup[] | null = null

function loadRollups() {
  if (scaleRollups && timeRollups && systemRollups) return

  try {
    // In Azure Functions the cwd is the api/ directory.
    // Rollup files must be placed at api/SQL_Files/lab_attribute_rollups/
    const basePath = join(__dirname, '..', '..', '..', 'SQL_Files', 'lab_attribute_rollups')

    scaleRollups  = JSON.parse(readFileSync(join(basePath, 'rollup_scale_type.json'), 'utf-8'))
    timeRollups   = JSON.parse(readFileSync(join(basePath, 'rollup_time_aspect.json'), 'utf-8'))
    systemRollups = JSON.parse(readFileSync(join(basePath, 'rollup_system.json'), 'utf-8'))
  } catch {
    scaleRollups  = []
    timeRollups   = []
    systemRollups = []
  }
}

function applyRollups(result: LabTestSearchResult): LabTestSearchResult {
  const scaleNorm  = result.scale?.trim().toLowerCase()
  const timeNorm   = result.time?.trim().toLowerCase()
  const systemNorm = result.system?.trim().toLowerCase()

  const scaleRollup  = scaleNorm  ? scaleRollups?.find(r => r.raw_value.trim().toLowerCase() === scaleNorm)  : null
  const timeRollup   = timeNorm   ? timeRollups?.find(r => r.raw_value.trim().toLowerCase() === timeNorm)    : null
  const systemRollup = systemNorm ? systemRollups?.find(r => r.raw_value.trim().toLowerCase() === systemNorm) : null

  return {
    ...result,
    scale:  scaleRollup?.label      || result.scale,
    time:   timeRollup?.time_bucket || result.time,
    system: systemRollup?.label     || result.system,
  }
}

app.http('labtest-search', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'labtest-search',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    console.log('=== Lab Test Search API called ===')
    try {
      loadRollups()

      const { searchterm } = await req.json() as LabTestSearchRequest
      const searchValue = searchterm?.trim() || ''
      console.log('Lab Test Search params:', { searchterm })

      const sql = `
        WITH base AS (
          SELECT
            cs.concept_id AS std_concept_id,
            cs.concept_name AS CONCEPT_NAME,
            cs.concept_code AS CONCEPT_CODE,
            cs.concept_class_id AS CONCEPT_CLASS_ID,
            cs.vocabulary_id AS VOCABULARY_ID
          FROM dbo.concept_search cs
          WHERE cs.domain_id = 'Measurement'
            AND cs.vocabulary_id IN ('LOINC', 'CPT4', 'HCPCS', 'SNOMED')
            AND (
              (cs.vocabulary_id = 'LOINC' AND cs.concept_class_id = 'Lab Test')
              OR cs.vocabulary_id = 'CPT4'
              OR cs.vocabulary_id = 'SNOMED'
              OR (cs.vocabulary_id = 'HCPCS' AND cs.concept_class_id = 'HCPCS')
            )
            AND cs.search_text_upper LIKE '%' + UPPER(@searchterm) + '%'
        ),
        prop  AS (SELECT CONCEPT_ID_1 std_concept_id, CONCEPT_ID_2 FROM CONCEPT_RELATIONSHIP JOIN base ON base.std_concept_id = CONCEPT_ID_1 WHERE RELATIONSHIP_ID = 'Has property'),
        scale AS (SELECT CONCEPT_ID_1 std_concept_id, CONCEPT_ID_2 FROM CONCEPT_RELATIONSHIP JOIN base ON base.std_concept_id = CONCEPT_ID_1 WHERE RELATIONSHIP_ID = 'Has scale type'),
        sys   AS (SELECT CONCEPT_ID_1 std_concept_id, CONCEPT_ID_2 FROM CONCEPT_RELATIONSHIP JOIN base ON base.std_concept_id = CONCEPT_ID_1 WHERE RELATIONSHIP_ID = 'Has system'),
        tm    AS (SELECT CONCEPT_ID_1 std_concept_id, CONCEPT_ID_2 FROM CONCEPT_RELATIONSHIP JOIN base ON base.std_concept_id = CONCEPT_ID_1 WHERE RELATIONSHIP_ID = 'Has time aspect'),
        panels AS (
          SELECT b.std_concept_id, COUNT(*) AS panel_count
          FROM base b
          INNER JOIN CONCEPT_RELATIONSHIP cr ON cr.CONCEPT_ID_2 = b.std_concept_id AND cr.RELATIONSHIP_ID = 'Contained in panel' AND COALESCE(cr.INVALID_REASON, '') = ''
          GROUP BY b.std_concept_id
        ),
        term_raw AS (
          SELECT
            'Lab Test' AS lab_test_type,
            b.std_concept_id, b.CONCEPT_NAME AS search_result, b.CONCEPT_CODE AS searched_code,
            b.CONCEPT_CLASS_ID AS searched_concept_class_id, b.VOCABULARY_ID AS vocabulary_id,
            p_c.CONCEPT_NAME AS property, sc_c.CONCEPT_NAME AS scale, sy_c.CONCEPT_NAME AS system, t_c.CONCEPT_NAME AS time,
            COALESCE(pn.panel_count, 0) AS panel_count
          FROM base b
          LEFT JOIN prop p   ON p.std_concept_id  = b.std_concept_id LEFT JOIN CONCEPT p_c  ON p_c.CONCEPT_ID  = p.CONCEPT_ID_2  AND COALESCE(p_c.INVALID_REASON,'')  = ''
          LEFT JOIN scale s  ON s.std_concept_id  = b.std_concept_id LEFT JOIN CONCEPT sc_c ON sc_c.CONCEPT_ID = s.CONCEPT_ID_2  AND COALESCE(sc_c.INVALID_REASON,'') = ''
          LEFT JOIN sys sy   ON sy.std_concept_id = b.std_concept_id LEFT JOIN CONCEPT sy_c ON sy_c.CONCEPT_ID = sy.CONCEPT_ID_2 AND COALESCE(sy_c.INVALID_REASON,'') = ''
          LEFT JOIN tm t     ON t.std_concept_id  = b.std_concept_id LEFT JOIN CONCEPT t_c  ON t_c.CONCEPT_ID  = t.CONCEPT_ID_2  AND COALESCE(t_c.INVALID_REASON,'')  = ''
          LEFT JOIN panels pn ON pn.std_concept_id = b.std_concept_id
        ),
        term AS (
          SELECT
            lab_test_type, std_concept_id, search_result, searched_code, searched_concept_class_id, vocabulary_id,
            NULLIF(STRING_AGG(CASE WHEN property IS NOT NULL THEN property END, ', '), '') AS property,
            NULLIF(STRING_AGG(CASE WHEN scale    IS NOT NULL THEN scale    END, ', '), '') AS scale,
            NULLIF(STRING_AGG(CASE WHEN system   IS NOT NULL THEN system   END, ', '), '') AS system,
            NULLIF(STRING_AGG(CASE WHEN time     IS NOT NULL THEN time     END, ', '), '') AS time,
            MAX(panel_count) AS panel_count
          FROM term_raw
          GROUP BY lab_test_type, std_concept_id, search_result, searched_code, searched_concept_class_id, vocabulary_id
        )
        SELECT * FROM term
        ORDER BY vocabulary_id, std_concept_id ASC
      `

      const results = await executeQuery<LabTestSearchResult>(sql, { searchterm: searchValue })
      const rolledUpResults = results.map(applyRollups)

      console.log('📤 Sending lab test search response with', rolledUpResults.length, 'results')
      return { jsonBody: { success: true, data: rolledUpResults } }
    } catch (err: any) {
      console.error('Lab Test Search API error:', err)
      return { status: 500, jsonBody: { success: false, error: err.message } }
    }
  },
})
