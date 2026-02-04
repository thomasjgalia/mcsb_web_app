// ============================================================================
// API Endpoint: Lab Test Panel Search
// ============================================================================
// Finds LOINC Panels that contain selected lab tests
// Endpoint: POST /api/labtest-panel-search
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  executeQuery,
  createErrorResponse,
} from './lib/azuresql.js';

interface LabTestPanelSearchRequest {
  labTestConceptIds: number[];
}

interface LabTestPanelSearchResult {
  lab_test_type: string;
  std_concept_id: number;          // The lab test concept ID from shopping cart
  panel_concept_id: number;
  search_result: string;            // Panel name
  searched_code: string;            // Panel code
  searched_concept_class_id: string;
  vocabulary_id: string;
  property: null;
  scale: null;
  system: null;
  time: null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== Lab Test Panel Search API called ===');
  console.log('Method:', req.method);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  try {
    const { labTestConceptIds } = req.body as LabTestPanelSearchRequest;
    console.log('Lab Test Panel Search params:', { labTestConceptIds });

    // Validate input
    if (!labTestConceptIds || !Array.isArray(labTestConceptIds) || labTestConceptIds.length === 0) {
      return res.status(400).json(createErrorResponse('labTestConceptIds array is required', 400));
    }

    // Build the SQL query to find panels containing the selected lab tests
    // Returns lab tests AND their containing panels, sorted by std_concept_id > lab_test_type > searched_code
    const sql = `
      WITH selected_tests AS (
        -- The lab tests selected by the user (from shopping cart)
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
        -- Find panels that contain the selected lab tests
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
      -- UNION lab tests with their containing panels (only if panels exist)
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
    `;

    // Convert array to comma-separated string for SQL Server
    const labTestIds = labTestConceptIds.join(',');

    // Execute query
    const results = await executeQuery<LabTestPanelSearchResult>(sql, {
      labTestIds,
    });

    console.log('📤 Sending lab test panel search response with', results.length, 'results');
    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Lab Test Panel Search API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
}
