// ============================================================================
// API Endpoint: Step 2 - Explore Hierarchy
// ============================================================================
// Vercel Serverless Function
// Endpoint: POST /api/hierarchy
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  executeQuery,
  executeStoredProcedure,
  createErrorResponse,
} from './lib/azuresql.js';

interface HierarchyRequest {
  concept_id: number;
}

interface HierarchyResult {
  steps_away: number;
  concept_name: string;
  hierarchy_concept_id: number;
  concept_code: string;
  vocabulary_id: string;
  concept_class_id: string;
  root_term: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  try {
    const { concept_id } = req.body as HierarchyRequest;

    // Validate input
    if (!concept_id || typeof concept_id !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Valid concept ID is required',
      });
    }

    // Dual-Path Implementation: Try stored procedure first
    const useStoredProcs = process.env.USE_STORED_PROCEDURES === 'true';

    if (useStoredProcs) {
      console.log('🚀 Hierarchy: Using stored procedure');
      try {
        const results = await executeStoredProcedure<HierarchyResult>(
          'dbo.sp_GetConceptHierarchy',
          { ConceptId: concept_id }
        );

        return res.status(200).json({
          success: true,
          data: results,
        });
      } catch (error) {
        console.error('❌ Stored procedure failed, falling back to dynamic queries:', error);
        // Fall through to old path
      }
    }

    // OLD PATH: Two-query pattern (domain lookup + hierarchy query)
    console.log('🔄 Hierarchy: Using dynamic queries');
    const domainSQL = `
      SELECT domain_id FROM concept WHERE concept_id = @concept_id
    `;

    const domainResult = await executeQuery<{ domain_id: string }>(domainSQL, {
      concept_id,
    });

    if (domainResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Concept not found',
      });
    }

    const domain_id = domainResult[0].domain_id;

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

    // Build the main hierarchy query (v5 - removed Measurement domain filter, just highlight Lab Test in UI)
    // The concept_ancestor table includes self-referential rows (steps_away=0)
    // so we get ancestors + the concept itself in the first query, descendants in the second
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
      JOIN concept_ancestor ca
        ON ca.descendant_concept_id = c.concept_id
      JOIN concept a
        ON a.concept_id = ca.ancestor_concept_id
      WHERE
        c.concept_id = @concept_id
        AND a.vocabulary_id IN ${vocabularyList}
        AND (
             -- Drug domain refinement
             (@domain_id = 'Drug' AND (
                  (a.vocabulary_id = 'ATC'    AND a.concept_class_id IN ('ATC 5th','ATC 4th','ATC 3rd','ATC 2nd','ATC 1st'))
               OR (a.vocabulary_id = 'RxNorm' AND a.concept_class_id IN ('Clinical Drug','Ingredient'))
             ))
          -- Pass-through logic for all other domains
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
      JOIN concept_ancestor ca
        ON ca.ancestor_concept_id = c.concept_id
      JOIN concept a
        ON a.concept_id = ca.descendant_concept_id
      WHERE
        c.concept_id = @concept_id
        AND a.vocabulary_id IN ${vocabularyList}
        AND (
             -- Drug domain descendant refinement (now matches parents)
             (@domain_id = 'Drug' AND (
                  (a.vocabulary_id = 'ATC'    AND a.concept_class_id IN ('ATC 5th','ATC 4th','ATC 3rd','ATC 2nd','ATC 1st'))
               OR (a.vocabulary_id = 'RxNorm' AND a.concept_class_id IN ('Clinical Drug','Ingredient'))
             ))
          -- Pass-through for all other domains
          OR (@domain_id <> 'Drug')
        )

      ORDER BY steps_away DESC
    `;

    // Execute query
    const results = await executeQuery<HierarchyResult>(sql, {
      concept_id,
      domain_id,
    });

    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Hierarchy API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
}
