-- ============================================================================
-- Table-Valued Parameter Type: ConceptIdList
-- ============================================================================
-- Purpose: Pass array of concept IDs to stored procedures
-- Used by: sp_BuildCodeSet_Hierarchical
-- ============================================================================

-- Drop type if it exists (only if no dependent objects)
IF EXISTS (SELECT * FROM sys.types WHERE is_table_type = 1 AND name = 'ConceptIdList')
BEGIN
    DROP TYPE dbo.ConceptIdList;
END
GO

-- Create table type
CREATE TYPE dbo.ConceptIdList AS TABLE (
    concept_id INT NOT NULL PRIMARY KEY
);
GO

-- Grant execute permission to application user
-- GRANT EXECUTE ON TYPE::dbo.ConceptIdList TO [your_app_user];
-- GO
