-- ============================================================================
-- Azure SQL Schema for Medical Code Set Builder - User Data Storage
-- ============================================================================
-- Purpose: Store user profiles, saved code sets, and search history
-- Supabase handles authentication; Azure SQL stores application data
-- Link via supabase_user_id (UUID from Supabase auth.users.id)
-- ============================================================================

-- Table 1: User Profiles
-- Links Supabase user_id to user preferences and display settings
CREATE TABLE user_profiles (
  supabase_user_id UNIQUEIDENTIFIER PRIMARY KEY,
  email NVARCHAR(255) NOT NULL,
  display_name NVARCHAR(100),
  preferences NVARCHAR(MAX), -- JSON string for user settings
  created_at DATETIME2 DEFAULT GETDATE(),
  updated_at DATETIME2 DEFAULT GETDATE(),
  CONSTRAINT UQ_user_profiles_email UNIQUE (email)
);

-- Table 2: Saved Code Sets
-- Stores user's code sets with metadata for retrieval and management
CREATE TABLE saved_code_sets (
  id INT IDENTITY(1,1) PRIMARY KEY,
  supabase_user_id UNIQUEIDENTIFIER NOT NULL,
  code_set_name NVARCHAR(200) NOT NULL,
  description NVARCHAR(MAX),
  concepts NVARCHAR(MAX) NOT NULL, -- JSON array of concepts with hierarchy info
  total_concepts INT NOT NULL DEFAULT 0,
  created_at DATETIME2 DEFAULT GETDATE(),
  updated_at DATETIME2 DEFAULT GETDATE(),
  CONSTRAINT FK_code_sets_user FOREIGN KEY (supabase_user_id)
    REFERENCES user_profiles(supabase_user_id) ON DELETE CASCADE
);

-- Table 3: Search History
-- Tracks recent searches for quick access and analytics
CREATE TABLE search_history (
  id INT IDENTITY(1,1) PRIMARY KEY,
  supabase_user_id UNIQUEIDENTIFIER NOT NULL,
  search_term NVARCHAR(500) NOT NULL,
  domain_type NVARCHAR(50), -- Domain filter used (if any)
  result_count INT,
  searched_at DATETIME2 DEFAULT GETDATE(),
  CONSTRAINT FK_search_history_user FOREIGN KEY (supabase_user_id)
    REFERENCES user_profiles(supabase_user_id) ON DELETE CASCADE
);

-- Performance Indexes
CREATE INDEX idx_code_sets_user ON saved_code_sets(supabase_user_id);
CREATE INDEX idx_code_sets_created ON saved_code_sets(created_at DESC);
CREATE INDEX idx_search_history_user ON search_history(supabase_user_id);
CREATE INDEX idx_search_history_date ON search_history(searched_at DESC);

-- Trigger to auto-update updated_at timestamp on user_profiles
CREATE TRIGGER trg_user_profiles_updated_at
ON user_profiles
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE user_profiles
  SET updated_at = GETDATE()
  FROM user_profiles u
  INNER JOIN inserted i ON u.supabase_user_id = i.supabase_user_id;
END;
GO

-- Trigger to auto-update updated_at timestamp on saved_code_sets
CREATE TRIGGER trg_saved_code_sets_updated_at
ON saved_code_sets
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE saved_code_sets
  SET updated_at = GETDATE()
  FROM saved_code_sets s
  INNER JOIN inserted i ON s.id = i.id;
END;
GO

-- ============================================================================
-- Sample Queries for Testing
-- ============================================================================

-- Get user profile
-- SELECT * FROM user_profiles WHERE supabase_user_id = '<uuid>';

-- Get user's saved code sets
-- SELECT id, code_set_name, description, total_concepts, created_at
-- FROM saved_code_sets
-- WHERE supabase_user_id = '<uuid>'
-- ORDER BY created_at DESC;

-- Get user's recent search history
-- SELECT TOP 10 search_term, domain_type, result_count, searched_at
-- FROM search_history
-- WHERE supabase_user_id = '<uuid>'
-- ORDER BY searched_at DESC;

-- Insert new user profile (on first login)
-- INSERT INTO user_profiles (supabase_user_id, email, display_name)
-- VALUES ('<uuid>', 'user@veradigm.me', 'User Name');

-- Save a code set
-- INSERT INTO saved_code_sets (supabase_user_id, code_set_name, description, concepts, total_concepts)
-- VALUES ('<uuid>', 'Diabetes Medications', 'All diabetes drug codes', '<json>', 150);

-- Track a search
-- INSERT INTO search_history (supabase_user_id, search_term, domain_type, result_count)
-- VALUES ('<uuid>', 'diabetes', 'Condition', 25);
