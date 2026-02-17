-- ============================================================================
-- Stored Procedure: sp_GetCodeSetDetail
-- ============================================================================
-- Purpose: Get full code set details including all concept data
--          Includes authorization check to ensure user owns the code set
-- ============================================================================

-- Drop procedure if it exists
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'sp_GetCodeSetDetail')
BEGIN
    DROP PROCEDURE dbo.sp_GetCodeSetDetail;
END
GO

CREATE PROCEDURE dbo.sp_GetCodeSetDetail
    @id INT,
    @user_id NVARCHAR(128)
AS
BEGIN
    SET NOCOUNT ON;

    -- Get code set with authorization check
    SELECT
        id,
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
        is_materialized,
        created_at,
        updated_at
    FROM saved_code_sets
    WHERE id = @id
      AND user_id = @user_id;

    -- Note: Returns empty result set if not found or unauthorized
    -- Application layer should handle 404/403 responses appropriately
END;
GO

-- Grant execute permission to application user
-- GRANT EXECUTE ON dbo.sp_GetCodeSetDetail TO [your_app_user];
-- GO
