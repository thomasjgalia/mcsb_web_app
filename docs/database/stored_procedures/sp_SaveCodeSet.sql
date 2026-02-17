-- ============================================================================
-- Stored Procedure: sp_SaveCodeSet
-- ============================================================================
-- Purpose: Save a new code set with hybrid storage approach
--          - Small code sets (<500): Store full materialized concepts
--          - Large code sets (>=500): Store anchor concepts only for rebuild
-- ============================================================================

-- Drop procedure if it exists
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'sp_SaveCodeSet')
BEGIN
    DROP PROCEDURE dbo.sp_SaveCodeSet;
END
GO

CREATE PROCEDURE dbo.sp_SaveCodeSet
    @user_id NVARCHAR(128),
    @code_set_name NVARCHAR(200),
    @description NVARCHAR(MAX) = NULL,
    @concepts NVARCHAR(MAX),
    @total_concepts INT,
    @source_type VARCHAR(10),
    @source_metadata NVARCHAR(MAX) = NULL,
    @build_type VARCHAR(20) = NULL,
    @anchor_concepts NVARCHAR(MAX) = NULL,
    @build_parameters NVARCHAR(MAX) = NULL,
    @is_materialized BIT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NewId INT;

    -- Insert the code set
    INSERT INTO saved_code_sets (
        user_id,
        code_set_name,
        description,
        concepts,
        total_concepts,
        source_type,
        source_metadata,
        build_type,
        anchor_concepts,
        build_parameters,
        is_materialized
    )
    VALUES (
        @user_id,
        @code_set_name,
        @description,
        @concepts,
        @total_concepts,
        @source_type,
        @source_metadata,
        @build_type,
        @anchor_concepts,
        @build_parameters,
        @is_materialized
    );

    -- Get the newly created ID
    SET @NewId = SCOPE_IDENTITY();

    -- Return the ID
    SELECT @NewId AS id;
END;
GO

-- Grant execute permission to application user
-- GRANT EXECUTE ON dbo.sp_SaveCodeSet TO [your_app_user];
-- GO
