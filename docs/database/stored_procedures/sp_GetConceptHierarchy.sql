-- ============================================================================
-- Stored Procedure: sp_GetConceptHierarchy
-- ============================================================================
-- Purpose: Get concept hierarchy with ancestors and descendants in 1 query
-- concept table references replaced with concept_search
-- TOP 1 on domain lookup guards against non-unique concept_id in concept_search
-- ============================================================================

ALTER PROCEDURE dbo.sp_GetConceptHierarchy
    @ConceptId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @DomainId NVARCHAR(50);
    SELECT TOP 1 @DomainId = domain_id
    FROM dbo.concept_search
    WHERE concept_id = @ConceptId;

    IF @DomainId IS NULL
    BEGIN
        RAISERROR('Concept not found', 16, 1);
        RETURN;
    END

    -- Ancestors (positive steps_away)
    SELECT
        ca.min_levels_of_separation      AS steps_away,
        a.searched_concept_name          AS concept_name,
        a.concept_id                     AS hierarchy_concept_id,
        a.searched_concept_code          AS concept_code,
        a.searched_vocabulary_id         AS vocabulary_id,
        a.searched_concept_class_id      AS concept_class_id,
        c.searched_concept_name          AS root_term
    FROM dbo.concept_search c
    JOIN concept_ancestor ca
        ON ca.descendant_concept_id = c.concept_id
    JOIN dbo.concept_search a
        ON a.concept_id = ca.ancestor_concept_id
    WHERE
        c.concept_id = @ConceptId
        AND (
            (@DomainId = 'Condition'   AND a.searched_vocabulary_id IN ('ICD10CM','SNOMED','ICD9CM'))
            OR (@DomainId = 'Observation' AND a.searched_vocabulary_id IN ('ICD10CM','SNOMED','LOINC','CPT4','HCPCS'))
            OR (@DomainId = 'Drug'        AND a.searched_vocabulary_id IN ('RxNorm','NDC','CPT4','CVX','HCPCS','ATC'))
            OR (@DomainId = 'Measurement' AND a.searched_vocabulary_id IN ('LOINC','CPT4','SNOMED','HCPCS'))
            OR (@DomainId = 'Procedure'   AND a.searched_vocabulary_id IN ('CPT4','HCPCS','SNOMED','ICD09PCS','LOINC','ICD10PCS'))
        )
        AND (
            (@DomainId = 'Drug' AND (
                    (a.searched_vocabulary_id = 'ATC'    AND a.searched_concept_class_id IN ('ATC 5th','ATC 4th','ATC 3rd','ATC 2nd','ATC 1st'))
                OR  (a.searched_vocabulary_id = 'RxNorm' AND a.searched_concept_class_id IN ('Clinical Drug','Ingredient'))
            ))
            OR (@DomainId <> 'Drug')
        )

    UNION

    -- Descendants (negative steps_away)
    SELECT
        ca.min_levels_of_separation * -1 AS steps_away,
        a.searched_concept_name          AS concept_name,
        a.concept_id                     AS hierarchy_concept_id,
        a.searched_concept_code          AS concept_code,
        a.searched_vocabulary_id         AS vocabulary_id,
        a.searched_concept_class_id      AS concept_class_id,
        c.searched_concept_name          AS root_term
    FROM dbo.concept_search c
    JOIN concept_ancestor ca
        ON ca.ancestor_concept_id = c.concept_id
    JOIN dbo.concept_search a
        ON a.concept_id = ca.descendant_concept_id
    WHERE
        c.concept_id = @ConceptId
        AND (
            (@DomainId = 'Condition'   AND a.searched_vocabulary_id IN ('ICD10CM','SNOMED','ICD9CM'))
            OR (@DomainId = 'Observation' AND a.searched_vocabulary_id IN ('ICD10CM','SNOMED','LOINC','CPT4','HCPCS'))
            OR (@DomainId = 'Drug'        AND a.searched_vocabulary_id IN ('RxNorm','NDC','CPT4','CVX','HCPCS','ATC'))
            OR (@DomainId = 'Measurement' AND a.searched_vocabulary_id IN ('LOINC','CPT4','SNOMED','HCPCS'))
            OR (@DomainId = 'Procedure'   AND a.searched_vocabulary_id IN ('CPT4','HCPCS','SNOMED','ICD09PCS','LOINC','ICD10PCS'))
        )
        AND (
            (@DomainId = 'Drug' AND (
                    (a.searched_vocabulary_id = 'ATC'    AND a.searched_concept_class_id IN ('ATC 5th','ATC 4th','ATC 3rd','ATC 2nd','ATC 1st'))
                OR  (a.searched_vocabulary_id = 'RxNorm' AND a.searched_concept_class_id IN ('Clinical Drug','Ingredient'))
            ))
            OR (@DomainId <> 'Drug')
        )

    ORDER BY steps_away DESC;
END;
GO
