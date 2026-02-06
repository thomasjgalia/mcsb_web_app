// ============================================================================
// API Endpoint: Step 1 - Search Concepts
// ============================================================================
// Vercel Serverless Function
// Endpoint: POST /api/search
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  executeQuery,
  executeStoredProcedure,
  createErrorResponse,
} from './lib/azuresql.js';

interface SearchRequest {
  searchterm: string;
  domain_id: string;
}

interface SearchResult {
  standard_name: string;
  std_concept_id: number;
  standard_code: string;
  standard_vocabulary: string;
  concept_class_id: string;
  search_result: string;
  searched_code: string;
  searched_vocabulary: string;
  searched_concept_class_id: string;
  searched_term: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== Search API called ===');
  console.log('Method:', req.method);
  console.log('Azure SQL Config:', {
    server: process.env.AZURE_SQL_SERVER,
    database: process.env.AZURE_SQL_DATABASE,
    hasPassword: !!process.env.AZURE_SQL_PASSWORD,
  });

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  try {
    const apiStartTime = Date.now();
    const { searchterm, domain_id } = req.body as SearchRequest;
    console.log('Search params:', { searchterm, domain_id });

    // Validate input
    if (!searchterm || searchterm.trim().length < 2) {
      return res
        .status(400)
        .json(createErrorResponse('Search term must be at least 2 characters', 400));
    }

    if (!domain_id) {
      return res.status(400).json(createErrorResponse('Domain ID is required', 400));
    }

    // Dual-path implementation: stored procedure OR dynamic queries
    const useStoredProcs = process.env.USE_STORED_PROCEDURES === 'true';
    let results: SearchResult[] = [];

    if (useStoredProcs) {
      // NEW PATH: Use stored procedure
      console.log('🚀 Search: Using stored procedure');
      const spStartTime = Date.now();
      try {
        results = await executeStoredProcedure<SearchResult>(
          'dbo.sp_SearchConcepts',
          {
            SearchTerm: searchterm.trim(),
            DomainId: domain_id,
          }
        );
        console.log(`⏱️  Stored procedure call completed in ${Date.now() - spStartTime}ms`);
      } catch (error) {
        console.error('Stored procedure failed, falling back to dynamic queries:', error);
        // Fall through to dynamic query path
      }
    }

    if (!useStoredProcs || results.length === 0) {
      // OLD PATH: Dynamic SQL query
      console.log('🔄 Search: Using dynamic queries');

      // Build vocabulary IN clause based on domain
      let vocabularyList: string;
      switch (domain_id) {
        case 'Condition':
          vocabularyList = "('ICD10CM','SNOMED','ICD9CM')";
          break;
        case 'Observation':
          vocabularyList = "('ICD10CM','SNOMED','LOINC','CPT4','HCPCS')";
          break;
        case 'Drug':
          vocabularyList = "('RxNorm','NDC','CPT4','CVX','HCPCS','ATC')";
          break;
        case 'Measurement':
          vocabularyList = "('LOINC','CPT4','SNOMED','HCPCS')";
          break;
        case 'Procedure':
          vocabularyList = "('CPT4','HCPCS','SNOMED','ICD09PCS','LOINC','ICD10PCS')";
          break;
        default:
          vocabularyList = "('')";
      }

      // Build the SQL query (T-SQL syntax for Azure SQL)
      // Supports ATC and other classification concepts by not requiring standard mappings
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
            -- Match flags for ranking
            CASE WHEN TRY_CAST(@searchterm AS BIGINT) = c.concept_id THEN 1 ELSE 0 END AS is_exact_id_match,
            CASE WHEN c.concept_code = @searchterm THEN 1 ELSE 0 END AS is_exact_code_match,
            ABS(LEN(@searchterm) - LEN(c.concept_name)) AS name_length_delta
          FROM concept c
          WHERE
            -- Flexible search: concept_id, concept_code, or concept_name
            UPPER(CAST(c.concept_id AS NVARCHAR(30)) + ' ' + c.concept_code + ' ' + c.concept_name)
              LIKE '%' + UPPER(@searchterm) + '%'
            AND c.domain_id = @domain_id
            AND c.vocabulary_id IN ${vocabularyList}
            AND (
                 c.domain_id <> 'Drug'
              OR c.concept_class_id IN (
                   'Clinical Drug','Branded Drug','Ingredient','Clinical Pack','Branded Pack',
                   'Quant Clinical Drug','Quant Branded Drug','11-digit NDC',
                   -- ATC classification levels
                   'ATC 1st','ATC 2nd','ATC 3rd','ATC 4th','ATC 5th'
                 )
              OR c.vocabulary_id = 'ATC'
            )
            AND (c.invalid_reason IS NULL OR c.invalid_reason = '')
        ),
        mapped AS (
          -- Optional mapping to standard concepts (prefer when available)
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
          -- Prefer mapped standard target if present; otherwise use searched concept
          COALESCE(
            s_concept_name,
            CASE WHEN standard_concept = 'S' THEN concept_name END,
            concept_name
          ) AS standard_name,

          COALESCE(
            s_concept_id,
            CASE WHEN standard_concept = 'S' THEN concept_id END,
            concept_id
          ) AS std_concept_id,

          COALESCE(
            s_concept_code,
            CASE WHEN standard_concept = 'S' THEN concept_code END,
            concept_code
          ) AS standard_code,

          COALESCE(
            s_vocabulary_id,
            CASE WHEN standard_concept = 'S' THEN vocabulary_id END,
            vocabulary_id
          ) AS standard_vocabulary,

          COALESCE(
            s_concept_class_id,
            CASE WHEN standard_concept = 'S' THEN concept_class_id END,
            concept_class_id
          ) AS concept_class_id,

          -- Echo the searched concept context
          concept_name         AS search_result,
          concept_id           AS searched_concept_id,
          concept_code         AS searched_code,
          vocabulary_id        AS searched_vocabulary,
          concept_class_id     AS searched_concept_class_id,
          CAST(concept_id AS NVARCHAR(30)) + ' ' + concept_code + ' ' + concept_name AS searched_term
        FROM mapped
        ORDER BY
          -- 1) Exact ID matches first
          CASE WHEN is_exact_id_match = 1 THEN 0 ELSE 1 END,
          -- 2) Exact code matches next
          CASE WHEN is_exact_code_match = 1 THEN 0 ELSE 1 END,
          -- 3) Prefer mapped standard targets over unmapped originals
          CASE
            WHEN s_concept_id IS NOT NULL THEN 0  -- Mapped standard exists
            WHEN standard_concept = 'S'    THEN 1  -- Already standard
            ELSE 2  -- Unmapped original (e.g., ATC classification)
          END,
          -- 4) Name proximity
          name_length_delta,
          concept_name
      `;

      // Execute query
      results = await executeQuery<SearchResult>(sql, {
        searchterm: searchterm.trim(),
        domain_id,
      });
    }

    console.log('📤 Sending response with', results.length, 'results');
    console.log(`⏱️  TOTAL API TIME: ${Date.now() - apiStartTime}ms`);
    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Search API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
}
