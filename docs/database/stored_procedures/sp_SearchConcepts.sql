-- =============================================
-- sp_SearchConcepts - concept_search only, no joins
-- std_* columns pre-computed in warehouse table
-- temp table and concept_relationship/concept joins eliminated
-- =============================================

ALTER PROCEDURE dbo.sp_SearchConcepts
    @SearchTerm NVARCHAR(255),
    @DomainId   NVARCHAR(50)
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

    DECLARE @SearchTermUpper NVARCHAR(255) = UPPER(@SearchTerm);
    DECLARE @SearchTermId    BIGINT        = TRY_CAST(@SearchTerm AS BIGINT);

    -- Single pass: search and standard mapping resolved from pre-computed std_* columns
    -- No temp table, no concept_relationship join, no concept join needed
    SELECT TOP 500
        -- Standard concept (pre-computed in warehouse)
        cs.std_concept_name          AS standard_name,
        cs.std_concept_id            AS std_concept_id,
        cs.std_concept_code          AS standard_code,
        cs.std_vocabulary_id         AS standard_vocabulary,
        cs.std_concept_class_id      AS concept_class_id,
        -- Searched concept
        cs.searched_concept_name     AS search_result,
        cs.concept_id                AS searched_concept_id,
        cs.searched_concept_code     AS searched_code,
        cs.searched_vocabulary_id    AS searched_vocabulary,
        cs.searched_concept_class_id AS searched_concept_class_id,
        cs.searched_concept_name     AS searched_term
    FROM dbo.concept_search cs WITH (NOLOCK)
    WHERE cs.domain_id = @DomainId
        AND (
            (@DomainId = 'Condition'   AND cs.searched_vocabulary_id IN ('ICD10CM','SNOMED','ICD9CM'))
            OR (@DomainId = 'Observation' AND cs.searched_vocabulary_id IN ('ICD10CM','SNOMED','LOINC','CPT4','HCPCS'))
            OR (@DomainId = 'Drug'        AND cs.searched_vocabulary_id IN ('RxNorm','NDC','CPT4','CVX','ATC'))
            OR (@DomainId = 'Measurement' AND cs.searched_vocabulary_id IN ('LOINC','CPT4','SNOMED','HCPCS'))
            OR (@DomainId = 'Procedure'   AND cs.searched_vocabulary_id IN ('CPT4','HCPCS','SNOMED','ICD9Proc','ICD10PCS'))
        )
        AND (
            cs.domain_id <> 'Drug'
            OR cs.searched_concept_class_id IN (
                'Clinical Drug','Branded Drug','Ingredient','Clinical Pack','Branded Pack',
                'Quant Clinical Drug','Quant Branded Drug','11-digit NDC',
                'ATC 1st','ATC 2nd','ATC 3rd','ATC 4th','ATC 5th'
            )
            OR cs.searched_vocabulary_id = 'ATC'
        )
        AND cs.search_text_upper LIKE '%' + @SearchTermUpper + '%'
    ORDER BY
        CASE WHEN @SearchTermId = cs.concept_id          THEN 0 ELSE 1 END,
        CASE WHEN cs.searched_concept_code = @SearchTerm THEN 0 ELSE 1 END,
        ABS(LEN(@SearchTerm) - LEN(cs.searched_concept_name)),
        cs.searched_concept_name;

END;
