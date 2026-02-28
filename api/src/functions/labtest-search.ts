import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { readFileSync } from 'fs'
import { join } from 'path'
import { executeQuery } from '../lib/azuresql'

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
  scale: string | null
  system: string | null
  time: string | null
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
        SELECT
          'Lab Test'                        AS lab_test_type,
          cs.std_concept_id                 AS std_concept_id,
          cs.searched_concept_name          AS search_result,
          cs.searched_concept_code          AS searched_code,
          cs.searched_concept_class_id      AS searched_concept_class_id,
          cs.searched_vocabulary_id         AS vocabulary_id,
          cs.has_scale                      AS scale,
          cs.has_system                     AS system,
          cs.has_time                       AS time
        FROM dbo.concept_search cs
        WHERE cs.domain_id = 'Measurement'
          AND cs.searched_vocabulary_id IN ('LOINC', 'CPT4', 'HCPCS', 'SNOMED')
          AND (
            (cs.searched_vocabulary_id = 'LOINC' AND cs.searched_concept_class_id = 'Lab Test')
            OR cs.searched_vocabulary_id = 'CPT4'
            OR cs.searched_vocabulary_id = 'SNOMED'
            OR (cs.searched_vocabulary_id = 'HCPCS' AND cs.searched_concept_class_id = 'HCPCS')
          )
          AND cs.search_text_upper LIKE '%' + UPPER(@searchterm) + '%'
        ORDER BY cs.searched_vocabulary_id, cs.std_concept_id ASC
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
