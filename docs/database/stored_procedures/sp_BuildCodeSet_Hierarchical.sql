-- ============================================================================
-- Stored Procedure: sp_BuildCodeSet_Hierarchical
-- ============================================================================
-- Purpose: Build hierarchical code sets for multiple concepts
-- Replaced: concept_relationship('Maps to') + concept + 4 drug subqueries
-- Now uses: concept_ancestor + concept_search(std_concept_id join)
-- drug_* attributes pre-computed in concept_search, no subqueries needed
-- concept_attribute table eliminated (concept_attribute/value return NULL)
-- ============================================================================

ALTER PROCEDURE dbo.sp_BuildCodeSet_Hierarchical
    @ConceptIds  dbo.ConceptIdList READONLY,
    @ComboFilter NVARCHAR(20) = 'ALL'
AS
BEGIN
    SET NOCOUNT ON;

    -- Step 1: Get domain and root name for each input concept
    SELECT
        cs.concept_id,
        cs.domain_id,
        cs.searched_concept_name AS root_name
    INTO #concept_domains
    FROM dbo.concept_search cs
    INNER JOIN @ConceptIds ids ON ids.concept_id = cs.concept_id;

    -- Step 2: Expand via concept_ancestor, resolve coded concepts via std_concept_id
    -- concept_search join on std_concept_id replaces:
    --   concept_relationship('Maps to') + concept(d) + concept_relationship('RxNorm has dose form')
    --   + concept(frm) + dfglbl subquery + combo subquery + concept_attribute join
    SELECT
        cd.root_name                      AS root_concept_name,
        cs.searched_vocabulary_id         AS child_vocabulary_id,
        cs.searched_concept_code          AS child_code,
        cs.searched_concept_name          AS child_name,
        cs.concept_id                     AS child_concept_id,
        cs.searched_concept_class_id      AS concept_class_id,
        cs.drug_combinationyesno          AS combinationyesno,
        cs.drug_dose_form                 AS dose_form,
        cs.drug_dfg_name                  AS dfg_name,
        NULL                              AS concept_attribute,
        NULL                              AS value
    FROM #concept_domains cd
    JOIN concept_ancestor ca
        ON ca.ancestor_concept_id = cd.concept_id
    JOIN dbo.concept_search cs
        ON cs.std_concept_id = ca.descendant_concept_id
        AND cs.domain_id = cd.domain_id
        AND (
            (cd.domain_id = 'Condition'   AND cs.searched_vocabulary_id IN ('ICD10CM','SNOMED','ICD9CM'))
            OR (cd.domain_id = 'Observation' AND cs.searched_vocabulary_id IN ('ICD10CM','SNOMED','LOINC','CPT4','HCPCS'))
            OR (cd.domain_id = 'Drug'        AND cs.searched_vocabulary_id IN ('RxNorm','NDC','CPT4','CVX','HCPCS','ATC'))
            OR (cd.domain_id = 'Measurement' AND cs.searched_vocabulary_id IN ('LOINC','CPT4','SNOMED','HCPCS'))
            OR (cd.domain_id = 'Procedure'   AND cs.searched_vocabulary_id IN ('CPT4','HCPCS','SNOMED','ICD09PCS','LOINC','ICD10PCS'))
        )
    WHERE
        (
            -- Non-drug domains: include all
            cd.domain_id <> 'Drug'
            OR
            -- Drug domain: apply combo filter and class restrictions
            (
                (
                    UPPER(@ComboFilter) = 'ALL'
                    OR cs.drug_combinationyesno = UPPER(@ComboFilter)
                )
                AND cs.searched_concept_class_id IN (
                    'Clinical Drug','Branded Drug Form','Clinical Drug Form',
                    'Quant Branded Drug','Quant Clinical Drug','11-digit NDC'
                )
            )
        )
    ORDER BY cs.searched_vocabulary_id DESC, ca.min_levels_of_separation ASC;

    DROP TABLE #concept_domains;
END;
GO
