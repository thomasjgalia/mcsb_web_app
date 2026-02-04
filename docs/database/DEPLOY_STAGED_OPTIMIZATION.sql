-- ============================================================================
-- DEPLOYMENT SCRIPT: Staged Filtering + Vocabulary Corrections
-- ============================================================================
-- This script deploys the staged filtering optimization with corrected vocabularies
-- Expected performance improvement: 50-70% faster than previous version
-- ============================================================================

USE [omop_vocabulary];
GO

PRINT '============================================================================';
PRINT 'DEPLOYING: Staged Filtering Optimization + Vocabulary Fixes';
PRINT '============================================================================';
PRINT '';

-- ============================================================================
-- STEP 1: Verify prerequisites
-- ============================================================================
PRINT 'Step 1: Verifying prerequisites...';

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'concept_search')
BEGIN
    RAISERROR('ERROR: concept_search table does not exist.', 16, 1);
    RETURN;
END

DECLARE @RowCount INT;
SELECT @RowCount = COUNT(*) FROM dbo.concept_search;

IF @RowCount = 0
BEGIN
    RAISERROR('ERROR: concept_search table is empty.', 16, 1);
    RETURN;
END

PRINT '  ✓ concept_search table exists with ' + CAST(@RowCount AS VARCHAR(20)) + ' rows';

-- ============================================================================
-- STEP 2: Backup current version
-- ============================================================================
PRINT '';
PRINT 'Step 2: Backing up current stored procedure...';

-- Drop old backup if exists
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'sp_SearchConcepts_V1')
BEGIN
    DROP PROCEDURE dbo.sp_SearchConcepts_V1;
    PRINT '  ✓ Dropped old backup (sp_SearchConcepts_V1)';
END

-- Backup current version
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'sp_SearchConcepts')
BEGIN
    EXEC sp_rename 'dbo.sp_SearchConcepts', 'sp_SearchConcepts_V1';
    PRINT '  ✓ Backed up current version to sp_SearchConcepts_V1';
END
ELSE
BEGIN
    PRINT '  ℹ No existing sp_SearchConcepts found (first deployment)';
END
GO

-- ============================================================================
-- STEP 3: Deploy staged version
-- ============================================================================
PRINT '';
PRINT 'Step 3: Deploying staged filtering version...';
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

    -- OPTIMIZATION: Pre-uppercase the search term once
    DECLARE @SearchTermUpper NVARCHAR(255) = UPPER(@SearchTerm);

    -- STAGE 1: Filter by domain and vocabulary (FAST)
    WITH relevant_concepts AS (
        SELECT
            cs.concept_id,
            cs.concept_name,
            cs.concept_code,
            cs.vocabulary_id,
            cs.domain_id,
            cs.concept_class_id,
            cs.standard_concept,
            cs.search_text_upper
        FROM dbo.concept_search cs
        WHERE
            cs.domain_id = @DomainId
            AND (
                (@DomainId = 'Condition' AND cs.vocabulary_id IN ('ICD10CM','SNOMED','ICD9CM'))
                OR (@DomainId = 'Observation' AND cs.vocabulary_id IN ('ICD10CM','SNOMED','LOINC','CPT4','HCPCS'))
                OR (@DomainId = 'Drug' AND cs.vocabulary_id IN ('RxNorm','NDC','CPT4','CVX','ATC'))
                OR (@DomainId = 'Measurement' AND cs.vocabulary_id IN ('LOINC','CPT4','SNOMED','HCPCS'))
                OR (@DomainId = 'Procedure' AND cs.vocabulary_id IN ('CPT4','HCPCS','SNOMED','ICD9Proc','ICD10PCS'))
            )
            AND (
                cs.domain_id <> 'Drug'
                OR cs.concept_class_id IN (
                    'Clinical Drug','Branded Drug','Ingredient','Clinical Pack','Branded Pack',
                    'Quant Clinical Drug','Quant Branded Drug','11-digit NDC',
                    'ATC 1st','ATC 2nd','ATC 3rd','ATC 4th','ATC 5th'
                )
                OR cs.vocabulary_id = 'ATC'
            )
    ),
    -- STAGE 2: Text search on pre-filtered concepts
    hits AS (
        SELECT
            concept_id,
            concept_name,
            concept_code,
            vocabulary_id,
            domain_id,
            concept_class_id,
            standard_concept,
            CASE WHEN TRY_CAST(@SearchTerm AS BIGINT) = concept_id THEN 1 ELSE 0 END AS is_exact_id_match,
            CASE WHEN concept_code = @SearchTerm THEN 1 ELSE 0 END AS is_exact_code_match,
            ABS(LEN(@SearchTerm) - LEN(concept_name)) AS name_length_delta
        FROM relevant_concepts
        WHERE search_text_upper LIKE '%' + @SearchTermUpper + '%'
    ),
    -- STAGE 3: Map to standard concepts
    mapped AS (
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
        concept_name         AS search_result,
        concept_id           AS searched_concept_id,
        concept_code         AS searched_code,
        vocabulary_id        AS searched_vocabulary,
        concept_class_id     AS searched_concept_class_id,
        CAST(concept_id AS NVARCHAR(30)) + ' ' + concept_code + ' ' + concept_name AS searched_term
    FROM mapped
    ORDER BY
        CASE WHEN is_exact_id_match = 1 THEN 0 ELSE 1 END,
        CASE WHEN is_exact_code_match = 1 THEN 0 ELSE 1 END,
        CASE
            WHEN s_concept_id IS NOT NULL THEN 0
            WHEN standard_concept = 'S'    THEN 1
            ELSE 2
        END,
        name_length_delta,
        concept_name;
END;
GO

PRINT '  ✓ Deployed sp_SearchConcepts (Version 2.0 - Staged Filtering)';

-- ============================================================================
-- STEP 4: Performance Testing
-- ============================================================================
PRINT '';
PRINT '============================================================================';
PRINT 'PERFORMANCE TESTING';
PRINT '============================================================================';
PRINT '';

-- Test 1: Drug search
PRINT 'Test 1: Drug search (lisinopril)';
DECLARE @Test1Start DATETIME2 = SYSDATETIME();
EXEC dbo.sp_SearchConcepts @SearchTerm = 'lisinopril', @DomainId = 'Drug';
DECLARE @Test1End DATETIME2 = SYSDATETIME();
DECLARE @Test1Ms INT = DATEDIFF(MILLISECOND, @Test1Start, @Test1End);
PRINT '  ✓ NEW version: ' + CAST(@Test1Ms AS VARCHAR(10)) + 'ms';

-- Test 2: Condition search
PRINT '';
PRINT 'Test 2: Condition search (diabetes)';
DECLARE @Test2Start DATETIME2 = SYSDATETIME();
EXEC dbo.sp_SearchConcepts @SearchTerm = 'diabetes', @DomainId = 'Condition';
DECLARE @Test2End DATETIME2 = SYSDATETIME();
DECLARE @Test2Ms INT = DATEDIFF(MILLISECOND, @Test2Start, @Test2End);
PRINT '  ✓ NEW version: ' + CAST(@Test2Ms AS VARCHAR(10)) + 'ms';

-- Test 3: Measurement search
PRINT '';
PRINT 'Test 3: Measurement search (glucose)';
DECLARE @Test3Start DATETIME2 = SYSDATETIME();
EXEC dbo.sp_SearchConcepts @SearchTerm = 'glucose', @DomainId = 'Measurement';
DECLARE @Test3End DATETIME2 = SYSDATETIME();
DECLARE @Test3Ms INT = DATEDIFF(MILLISECOND, @Test3Start, @Test3End);
PRINT '  ✓ NEW version: ' + CAST(@Test3Ms AS VARCHAR(10)) + 'ms';

-- Test 4: Procedure search (testing corrected ICD9Proc vocabulary)
PRINT '';
PRINT 'Test 4: Procedure search (catheter)';
DECLARE @Test4Start DATETIME2 = SYSDATETIME();
EXEC dbo.sp_SearchConcepts @SearchTerm = 'catheter', @DomainId = 'Procedure';
DECLARE @Test4End DATETIME2 = SYSDATETIME();
DECLARE @Test4Ms INT = DATEDIFF(MILLISECOND, @Test4Start, @Test4End);
PRINT '  ✓ NEW version: ' + CAST(@Test4Ms AS VARCHAR(10)) + 'ms';

-- Compare with old version if it exists
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'sp_SearchConcepts_V1')
BEGIN
    PRINT '';
    PRINT '============================================================================';
    PRINT 'COMPARING WITH PREVIOUS VERSION';
    PRINT '============================================================================';
    PRINT '';

    PRINT 'Test 1: Drug search (lisinopril)';
    DECLARE @Old1Start DATETIME2 = SYSDATETIME();
    EXEC dbo.sp_SearchConcepts_V1 @SearchTerm = 'lisinopril', @DomainId = 'Drug';
    DECLARE @Old1End DATETIME2 = SYSDATETIME();
    DECLARE @Old1Ms INT = DATEDIFF(MILLISECOND, @Old1Start, @Old1End);
    PRINT '  OLD version: ' + CAST(@Old1Ms AS VARCHAR(10)) + 'ms';

    IF @Test1Ms < @Old1Ms
    BEGIN
        DECLARE @Improvement1 DECIMAL(5,1) = (CAST(@Old1Ms - @Test1Ms AS DECIMAL(10,2)) / @Old1Ms) * 100;
        PRINT '  ✓ Improvement: ' + CAST(@Improvement1 AS VARCHAR(10)) + '%';
    END
    ELSE
    BEGIN
        PRINT '  ⚠ No improvement detected';
    END
END

PRINT '';
PRINT '============================================================================';
PRINT 'DEPLOYMENT COMPLETE';
PRINT '============================================================================';
PRINT '';
PRINT 'Changes deployed:';
PRINT '  ✓ Staged filtering (domain/vocab → text search)';
PRINT '  ✓ Drug vocabulary: Removed HCPCS';
PRINT '  ✓ Procedure vocabulary: Removed LOINC, fixed ICD9Proc';
PRINT '';
PRINT 'Next steps:';
PRINT '  1. Test frontend search functionality';
PRINT '  2. Monitor performance in production';
PRINT '  3. If satisfied, drop sp_SearchConcepts_V1 backup';
PRINT '';
PRINT 'Rollback command (if needed):';
PRINT '  DROP PROCEDURE dbo.sp_SearchConcepts;';
PRINT '  EXEC sp_rename ''dbo.sp_SearchConcepts_V1'', ''sp_SearchConcepts'';';
