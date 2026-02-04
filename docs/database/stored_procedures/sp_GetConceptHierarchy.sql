-- ============================================================================
-- Stored Procedure: sp_GetConceptHierarchy
-- ============================================================================
-- Purpose: Get concept hierarchy with ancestors and descendants in 1 query
--          instead of 2 queries (domain lookup + hierarchy)
-- Performance: 2 queries → 1 query (50% reduction)
-- ============================================================================

-- Drop procedure if it exists
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'sp_GetConceptHierarchy')
BEGIN
    DROP PROCEDURE dbo.sp_GetConceptHierarchy;
END
GO

CREATE PROCEDURE dbo.sp_GetConceptHierarchy
    @ConceptId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Get domain_id inline (was previously a separate query)
    DECLARE @DomainId NVARCHAR(50);
    SELECT @DomainId = domain_id
    FROM concept
    WHERE concept_id = @ConceptId;

    -- Validate concept exists
    IF @DomainId IS NULL
    BEGIN
        RAISERROR('Concept not found', 16, 1);
        RETURN;
    END

    -- Return hierarchy: ancestors (positive steps_away) and descendants (negative steps_away)
    -- This is the UNION query from api/hierarchy.ts lines 92-148
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
        c.concept_id = @ConceptId
        AND (
            -- Domain-specific vocabulary filtering
            (@DomainId = 'Condition' AND a.vocabulary_id IN ('ICD10CM','SNOMED','ICD9CM'))
            OR (@DomainId = 'Observation' AND a.vocabulary_id IN ('ICD10CM','SNOMED','LOINC','CPT4','HCPCS'))
            OR (@DomainId = 'Drug' AND a.vocabulary_id IN ('RxNorm','NDC','CPT4','CVX','HCPCS','ATC'))
            OR (@DomainId = 'Measurement' AND a.vocabulary_id IN ('LOINC','CPT4','SNOMED','HCPCS'))
            OR (@DomainId = 'Procedure' AND a.vocabulary_id IN ('CPT4','HCPCS','SNOMED','ICD09PCS','LOINC','ICD10PCS'))
        )
        AND (
            -- Drug domain class refinement
            (@DomainId = 'Drug' AND (
                    (a.vocabulary_id = 'ATC' AND a.concept_class_id IN ('ATC 5th','ATC 4th','ATC 3rd','ATC 2nd','ATC 1st'))
                OR (a.vocabulary_id = 'RxNorm' AND a.concept_class_id IN ('Clinical Drug','Ingredient'))
            ))
            OR (@DomainId <> 'Drug')
        )

    UNION

    -- Descendants (negative steps_away)
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
        c.concept_id = @ConceptId
        AND (
            (@DomainId = 'Condition' AND a.vocabulary_id IN ('ICD10CM','SNOMED','ICD9CM'))
            OR (@DomainId = 'Observation' AND a.vocabulary_id IN ('ICD10CM','SNOMED','LOINC','CPT4','HCPCS'))
            OR (@DomainId = 'Drug' AND a.vocabulary_id IN ('RxNorm','NDC','CPT4','CVX','HCPCS','ATC'))
            OR (@DomainId = 'Measurement' AND a.vocabulary_id IN ('LOINC','CPT4','SNOMED','HCPCS'))
            OR (@DomainId = 'Procedure' AND a.vocabulary_id IN ('CPT4','HCPCS','SNOMED','ICD09PCS','LOINC','ICD10PCS'))
        )
        AND (
            (@DomainId = 'Drug' AND (
                    (a.vocabulary_id = 'ATC' AND a.concept_class_id IN ('ATC 5th','ATC 4th','ATC 3rd','ATC 2nd','ATC 1st'))
                OR (a.vocabulary_id = 'RxNorm' AND a.concept_class_id IN ('Clinical Drug','Ingredient'))
            ))
            OR (@DomainId <> 'Drug')
        )

    ORDER BY steps_away DESC;
END;
GO

-- Grant execute permission to application user
-- GRANT EXECUTE ON dbo.sp_GetConceptHierarchy TO [your_app_user];
-- GO
