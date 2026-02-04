-- ============================================================================
-- Stored Procedure: sp_SearchConcepts
-- ============================================================================
-- Purpose: Cache search query execution plan for faster repeated searches
-- Performance: Query plan cached by SQL Server for faster compilation
-- ============================================================================

-- Drop procedure if it exists
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'sp_SearchConcepts')
BEGIN
    DROP PROCEDURE dbo.sp_SearchConcepts;
END
GO

CREATE PROCEDURE dbo.sp_SearchConcepts
    @SearchTerm NVARCHAR(255),
    @DomainId NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    -- Validate input
    IF LEN(LTRIM(RTRIM(@SearchTerm))) < 2
    BEGIN
        RAISERROR('Search term must be at least 2 characters', 16, 1);
        RETURN;
    END

    IF @DomainId IS NULL OR @DomainId = ''
    BEGIN
        RAISERROR('Domain ID is required', 16, 1);
        RETURN;
    END;

    -- This is the complex 3-CTE query from api/search.ts lines 89-196
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
            CASE WHEN TRY_CAST(@SearchTerm AS BIGINT) = c.concept_id THEN 1 ELSE 0 END AS is_exact_id_match,
            CASE WHEN c.concept_code = @SearchTerm THEN 1 ELSE 0 END AS is_exact_code_match,
            ABS(LEN(@SearchTerm) - LEN(c.concept_name)) AS name_length_delta
        FROM concept c
        WHERE
            -- Flexible search: concept_id, concept_code, or concept_name
            UPPER(CAST(c.concept_id AS NVARCHAR(30)) + ' ' + c.concept_code + ' ' + c.concept_name)
                LIKE '%' + UPPER(@SearchTerm) + '%'
            AND c.domain_id = @DomainId
            AND (
                -- Domain-specific vocabulary filtering
                (@DomainId = 'Condition' AND c.vocabulary_id IN ('ICD10CM','SNOMED','ICD9CM'))
                OR (@DomainId = 'Observation' AND c.vocabulary_id IN ('ICD10CM','SNOMED','LOINC','CPT4','HCPCS'))
                OR (@DomainId = 'Drug' AND c.vocabulary_id IN ('RxNorm','NDC','CPT4','CVX','HCPCS','ATC'))
                OR (@DomainId = 'Measurement' AND c.vocabulary_id IN ('LOINC','CPT4','SNOMED','HCPCS'))
                OR (@DomainId = 'Procedure' AND c.vocabulary_id IN ('CPT4','HCPCS','SNOMED','ICD09PCS','LOINC','ICD10PCS'))
            )
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
        concept_name;
END;
GO

-- Grant execute permission to application user
-- GRANT EXECUTE ON dbo.sp_SearchConcepts TO [your_app_user];
-- GO
