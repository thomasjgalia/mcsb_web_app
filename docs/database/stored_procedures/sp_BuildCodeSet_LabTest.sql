-- ============================================================================
-- Stored Procedure: sp_BuildCodeSet_LabTest
-- ============================================================================
-- Purpose: Build lab test code sets with relationships
--          Returns concepts with their lab-specific relationships as JSON
-- Performance: Single query with IN clause and JSON aggregation
-- ============================================================================

-- Drop procedure if it exists
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'sp_BuildCodeSet_LabTest')
BEGIN
    DROP PROCEDURE dbo.sp_BuildCodeSet_LabTest;
END
GO

CREATE PROCEDURE dbo.sp_BuildCodeSet_LabTest
    @ConceptIds dbo.ConceptIdList READONLY
AS
BEGIN
    SET NOCOUNT ON;

    -- Build lab test code set with relationships
    SELECT
        C.CONCEPT_NAME                      AS root_concept_name,
        C.VOCABULARY_ID                     AS child_vocabulary_id,
        C.CONCEPT_CODE                      AS child_code,
        C.CONCEPT_NAME                      AS child_name,
        C.CONCEPT_ID                        AS child_concept_id,
        C.CONCEPT_CLASS_ID                  AS concept_class_id,
        NULL                                AS combinationyesno,
        NULL                                AS dose_form,
        NULL                                AS dfg_name,
        NULL                                AS concept_attribute,
        NULL                                AS value,
        JSON_QUERY((
            SELECT
                CR2.RELATIONSHIP_ID as relationship_id,
                S2.CONCEPT_NAME as value_name
            FROM CONCEPT_RELATIONSHIP CR2
            INNER JOIN CONCEPT S2 ON S2.CONCEPT_ID = CR2.CONCEPT_ID_2
            WHERE CR2.concept_id_1 = C.concept_id
              AND CR2.RELATIONSHIP_ID IN (
                'RxNorm has dose form',
                'Has property',
                'Has scale type',
                'Has system',
                'Has time aspect',
                'Has asso morph',
                'Has finding site',
                'Has component'
              )
            ORDER BY CR2.RELATIONSHIP_ID
            FOR JSON PATH
        )) AS relationships_json
    FROM CONCEPT C
    INNER JOIN @ConceptIds ids ON ids.concept_id = C.CONCEPT_ID
    ORDER BY C.VOCABULARY_ID, C.CONCEPT_CODE;
END;
GO

-- Grant execute permission to application user
-- GRANT EXECUTE ON dbo.sp_BuildCodeSet_LabTest TO [your_app_user];
-- GO
