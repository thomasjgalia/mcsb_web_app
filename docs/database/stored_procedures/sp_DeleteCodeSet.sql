-- ============================================================================
-- Stored Procedure: sp_DeleteCodeSet
-- ============================================================================
-- Purpose: Delete a code set with authorization check
--          Returns number of rows affected (0 if not found or unauthorized)
-- ============================================================================

-- Drop procedure if it exists
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'sp_DeleteCodeSet')
BEGIN
    DROP PROCEDURE dbo.sp_DeleteCodeSet;
END
GO

CREATE PROCEDURE dbo.sp_DeleteCodeSet
    @id INT,
    @user_id NVARCHAR(128)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @RowsAffected INT;

    -- Delete with authorization check
    DELETE FROM saved_code_sets
    WHERE id = @id
      AND user_id = @user_id;

    SET @RowsAffected = @@ROWCOUNT;

    -- Return result
    SELECT
        @RowsAffected AS rows_affected,
        CASE
            WHEN @RowsAffected > 0 THEN 1
            ELSE 0
        END AS deleted;
END;
GO

-- Grant execute permission to application user
-- GRANT EXECUTE ON dbo.sp_DeleteCodeSet TO [your_app_user];
-- GO
