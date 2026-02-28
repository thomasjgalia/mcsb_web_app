-- ============================================================================
-- Stored Procedure: sp_BuildCodeSet_Direct
-- ============================================================================
-- Purpose: Build direct code sets (no hierarchical expansion)
--          Returns only the concepts provided, without descendants
-- concept_relationship and concept tables eliminated
-- drug_* attributes now populated from concept_search (previously hardcoded NULL)
-- ============================================================================

ALTER PROCEDURE dbo.sp_BuildCodeSet_Direct
    @ConceptIds dbo.ConceptIdList READONLY
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        cs.searched_concept_name     AS root_concept_name,
        cs.searched_vocabulary_id    AS child_vocabulary_id,
        cs.searched_concept_code     AS child_code,
        cs.searched_concept_name     AS child_name,
        cs.concept_id                AS child_concept_id,
        cs.searched_concept_class_id AS concept_class_id,
        cs.drug_combinationyesno     AS combinationyesno,
        cs.drug_dose_form            AS dose_form,
        cs.drug_dfg_name             AS dfg_name,
        NULL                         AS concept_attribute,
        NULL                         AS value
    FROM dbo.concept_search cs
    INNER JOIN @ConceptIds ids ON ids.concept_id = cs.concept_id
    ORDER BY cs.searched_vocabulary_id, cs.searched_concept_code;
END;
GO
