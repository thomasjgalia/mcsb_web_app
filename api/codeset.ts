// ============================================================================
// API Endpoint: Step 3 - Build Code Set
// ============================================================================
// Vercel Serverless Function
// Endpoint: POST /api/codeset
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  executeStoredProcedure,
  createErrorResponse,
} from './lib/azuresql.js';

interface CodeSetRequest {
  concept_ids: number[];
  combo_filter?: 'ALL' | 'SINGLE' | 'COMBINATION';
  build_type?: 'hierarchical' | 'direct' | 'labtest';
}

interface CodeSetResult {
  root_concept_name: string;
  child_vocabulary_id: string;
  child_code: string;
  child_name: string;
  child_concept_id: number;
  concept_class_id: string;
  combinationyesno?: string;
  dose_form?: string;
  dfg_name?: string;
  concept_attribute?: string;
  value?: string;
  relationships_json?: string | null;
  relationships?: Array<{
    relationship_id: string;
    value_name: string;
  }>;
}

/**
 * Deduplicates code set results based on unique combination of:
 * vocabulary, code, name, concept_id, and class
 */
function deduplicateResults(results: CodeSetResult[]): CodeSetResult[] {
  const seen = new Map<string, CodeSetResult>();

  for (const result of results) {
    // Create a unique key based on vocabulary, code, name, concept_id, and class
    const key = `${result.child_vocabulary_id}|${result.child_code}|${result.child_name}|${result.child_concept_id}|${result.concept_class_id}`;

    if (!seen.has(key)) {
      seen.set(key, result);
    }
  }

  return Array.from(seen.values());
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
    const { concept_ids, combo_filter = 'ALL', build_type = 'hierarchical' } = req.body as CodeSetRequest;

    // Validate input
    if (!concept_ids || !Array.isArray(concept_ids) || concept_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one concept ID is required',
      });
    }

    // Execute query for each concept and combine results
    const allResults: CodeSetResult[] = [];

    // Handle Lab Test Build (same as Direct Build - no hierarchical expansion)
    if (build_type === 'labtest') {
      const startTime = Date.now();
      console.log(`🧪 Lab Test Build: Starting for ${concept_ids.length} concepts`);

      const tvpRows = concept_ids.map(id => [id]);
      const results = await executeStoredProcedure<CodeSetResult>(
        'dbo.sp_BuildCodeSet_LabTest',
        {},
        {
          name: 'ConceptIds',
          typeName: 'dbo.ConceptIdList',
          rows: tvpRows
        }
      );

      // Parse relationships_json into actual objects
      const parsedResults = results.map(r => ({
        ...r,
        relationships: r.relationships_json ? JSON.parse(r.relationships_json) : []
      }));

      allResults.push(...parsedResults);

      const duration = Date.now() - startTime;
      console.log(`✅ Lab Test Build: Completed in ${duration}ms - returned ${results.length} results`);

      // Deduplicate results based on vocabulary, code, name, concept_id, and class
      const deduped = deduplicateResults(allResults);
      console.log(`🔄 Lab Test Build: Deduplicated from ${allResults.length} to ${deduped.length} unique concepts`);

      return res.status(200).json({
        success: true,
        data: deduped,
      });
    }

    // Handle Direct Build (no hierarchical expansion)
    if (build_type === 'direct') {
      const startTime = Date.now();
      console.log(`🚀 Direct Build: Starting for ${concept_ids.length} concepts`);

      const tvpRows = concept_ids.map(id => [id]);
      const results = await executeStoredProcedure<CodeSetResult>(
        'dbo.sp_BuildCodeSet_Direct',
        {},
        {
          name: 'ConceptIds',
          typeName: 'dbo.ConceptIdList',
          rows: tvpRows
        }
      );

      allResults.push(...results);

      const duration = Date.now() - startTime;
      console.log(`✅ Direct Build: Completed in ${duration}ms - returned ${results.length} results`);

      // Deduplicate results based on vocabulary, code, name, concept_id, and class
      const deduped = deduplicateResults(allResults);
      console.log(`🔄 Direct Build: Deduplicated from ${allResults.length} to ${deduped.length} unique concepts`);

      return res.status(200).json({
        success: true,
        data: deduped,
      });
    }

    // Handle Hierarchical Build
    const startTime = Date.now();
    console.log(`🚀 Hierarchical Build: Using stored procedure for ${concept_ids.length} concepts`);

    const tvpRows = concept_ids.map(id => [id]);
    const results = await executeStoredProcedure<CodeSetResult>(
      'dbo.sp_BuildCodeSet_Hierarchical',
      { ComboFilter: combo_filter },
      {
        name: 'ConceptIds',
        typeName: 'dbo.ConceptIdList',
        rows: tvpRows
      }
    );

    allResults.push(...results);
    const duration = Date.now() - startTime;
    console.log(`✅ Hierarchical Build: Completed in ${duration}ms - returned ${results.length} results`);

    // Deduplicate results based on vocabulary, code, name, concept_id, and class
    const deduped = deduplicateResults(allResults);
    console.log(`🔄 Hierarchical Build: Deduplicated from ${allResults.length} to ${deduped.length} unique concepts`);

    return res.status(200).json({
      success: true,
      data: deduped,
    });
  } catch (error) {
    console.error('Code set API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
}
