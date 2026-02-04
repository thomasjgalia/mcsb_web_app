-- ============================================================================
-- Stored Procedure: sp_GetUserCodeSets
-- ============================================================================
-- Purpose: Get all saved code sets for a user (metadata only, no concept data)
--          Returns summary information for list view
-- ============================================================================

-- Drop procedure if it exists
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'sp_GetUserCodeSets')
BEGIN
    DROP PROCEDURE dbo.sp_GetUserCodeSets;
END
GO

CREATE PROCEDURE dbo.sp_GetUserCodeSets
    @supabase_user_id UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;

    -- Get code sets metadata for the user
    SELECT
        id,
        code_set_name,
        description,
        total_concepts,
        source_type,
        source_metadata,
        is_materialized,
        created_at,
        updated_at
    FROM saved_code_sets
    WHERE supabase_user_id = @supabase_user_id
    ORDER BY created_at DESC;
END;
GO

-- Grant execute permission to application user
-- GRANT EXECUTE ON dbo.sp_GetUserCodeSets TO [your_app_user];
-- GO
