-- ============================================================================
-- Stored Procedure: sp_BuildCodeSet_LabTest
-- ============================================================================
-- Purpose: Build lab test code sets (no hierarchical expansion)
--          Returns concepts provided with lab attributes from concept_search
-- CONCEPT_RELATIONSHIP and CONCEPT joins eliminated
-- relationships_json removed - has_* attributes pre-computed in concept_search
-- ============================================================================

ALTER PROCEDURE dbo.sp_BuildCodeSet_LabTest
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
        NULL                         AS combinationyesno,
        NULL                         AS dose_form,
        NULL                         AS dfg_name,
        cs.has_scale                 AS concept_attribute,
        cs.has_system                AS value
    FROM dbo.concept_search cs
    INNER JOIN @ConceptIds ids ON ids.concept_id = cs.concept_id
    ORDER BY cs.searched_vocabulary_id, cs.searched_concept_code;
END;
GO
