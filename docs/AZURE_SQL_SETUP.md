# Azure SQL User Data Storage Setup

This guide explains how to set up Azure SQL tables for storing user profiles, saved code sets, and search history.

## Overview

- **Supabase**: Handles authentication only (user sign in/sign up)
- **Azure SQL**: Stores all application data (profiles, code sets, search history)
- **Link**: Supabase `user_id` (UUID) is stored in Azure SQL tables

## Database Schema

The schema includes three tables:

### 1. `user_profiles`
Stores user profile information linked to Supabase user ID.

**Columns:**
- `supabase_user_id` (UNIQUEIDENTIFIER, PK) - Links to Supabase auth.users.id
- `email` (NVARCHAR(255)) - User's email address
- `display_name` (NVARCHAR(100)) - Optional display name
- `preferences` (NVARCHAR(MAX)) - JSON string for user settings
- `created_at` (DATETIME2) - Profile creation timestamp
- `updated_at` (DATETIME2) - Last update timestamp

### 2. `saved_code_sets`
Stores user's saved code sets with full concept details.

**Columns:**
- `id` (INT, IDENTITY, PK) - Auto-incrementing primary key
- `supabase_user_id` (UNIQUEIDENTIFIER, FK) - Links to user_profiles
- `code_set_name` (NVARCHAR(200)) - Name of the code set
- `description` (NVARCHAR(MAX)) - Optional description
- `concepts` (NVARCHAR(MAX)) - JSON array of SavedCodeSetConcept objects
- `total_concepts` (INT) - Number of concepts in the set
- `created_at` (DATETIME2) - Creation timestamp
- `updated_at` (DATETIME2) - Last update timestamp

### 3. `search_history`
Tracks user searches for quick access and analytics.

**Columns:**
- `id` (INT, IDENTITY, PK) - Auto-incrementing primary key
- `supabase_user_id` (UNIQUEIDENTIFIER, FK) - Links to user_profiles
- `search_term` (NVARCHAR(500)) - The search query
- `domain_type` (NVARCHAR(50)) - Optional domain filter
- `result_count` (INT) - Number of results returned
- `searched_at` (DATETIME2) - Search timestamp

## Setup Instructions

### Step 1: Run the Schema Script

1. Open Azure Data Studio or SQL Server Management Studio
2. Connect to your Azure SQL database: `mcsb_high`
3. Open the file: `azure_sql_schema.sql`
4. Execute the entire script

This will create:
- All three tables
- Foreign key constraints
- Performance indexes
- Auto-update triggers for `updated_at` columns

### Step 2: Verify Tables Were Created

Run this query to verify:

```sql
SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
  AND TABLE_NAME IN ('user_profiles', 'saved_code_sets', 'search_history')
ORDER BY TABLE_NAME;
```

You should see all three tables listed.

### Step 3: Test with Sample Data

Insert a test user profile:

```sql
-- Replace with your actual Supabase user ID
DECLARE @test_user_id UNIQUEIDENTIFIER = 'YOUR-SUPABASE-USER-ID-HERE';

INSERT INTO user_profiles (supabase_user_id, email, display_name)
VALUES (@test_user_id, 'test@veradigm.me', 'Test User');

-- Verify insert
SELECT * FROM user_profiles WHERE supabase_user_id = @test_user_id;
```

## API Endpoints (To Be Implemented)

The following API endpoints will be created in `api/` directory:

### User Profile
- `POST /api/user/profile` - Create or update user profile
- `GET /api/user/profile/:userId` - Get user profile

### Code Sets
- `POST /api/user/codesets` - Save a new code set
- `GET /api/user/codesets/:userId` - Get user's saved code sets (metadata only)
- `GET /api/user/codesets/detail/:codeSetId` - Get full code set details
- `DELETE /api/user/codesets/:codeSetId` - Delete a code set

### Search History
- `POST /api/user/search-history` - Track a search
- `GET /api/user/search-history/:userId?limit=10` - Get recent searches

## Frontend Integration

The frontend API functions are already created in `src/lib/api.ts`:

```typescript
import {
  upsertUserProfile,
  getUserProfile,
  saveCodeSet,
  getSavedCodeSets,
  getCodeSetDetail,
  deleteCodeSet,
  trackSearch,
  getSearchHistory,
} from './lib/api';

// Example: Create user profile on first login
await upsertUserProfile(user.id, user.email, 'John Doe');

// Example: Save a code set
await saveCodeSet(user.id, {
  code_set_name: 'Diabetes Medications',
  description: 'All diabetes drug codes',
  concepts: shoppingCart, // Array of CartItem objects
});

// Example: Get user's saved code sets
const savedSets = await getSavedCodeSets(user.id);

// Example: Track a search
await trackSearch(user.id, 'diabetes', 'Condition', 25);
```

## Data Flow

1. **User Signs In** → Supabase authenticates → Returns JWT with `user.id`
2. **First Login** → Frontend calls `upsertUserProfile` → Creates record in `user_profiles`
3. **User Searches** → Frontend calls `trackSearch` → Inserts into `search_history`
4. **User Saves Code Set** → Frontend calls `saveCodeSet` → Inserts into `saved_code_sets`
5. **User Loads Saved Sets** → Frontend calls `getSavedCodeSets` → Queries `saved_code_sets`

## Security Considerations

1. **API Authentication**: All API endpoints should verify the Supabase JWT token
2. **User Authorization**: Users can only access their own data (check `supabase_user_id`)
3. **SQL Injection**: Use parameterized queries (never string concatenation)
4. **JSON Validation**: Validate JSON structure before storing in `concepts` and `preferences` fields

## Example Backend API Implementation

Here's a sample structure for the backend API (to be created):

```javascript
// api/user/profile.js
import { supabase } from '../lib/supabase-admin';
import sql from 'mssql';

export default async function handler(req, res) {
  // 1. Verify JWT token
  const token = req.headers.authorization?.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  // 2. Process request
  if (req.method === 'POST') {
    const { supabase_user_id, email, display_name } = req.body;

    // Verify user can only update their own profile
    if (supabase_user_id !== user.id) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    // 3. Execute SQL query
    const result = await sql.query`
      MERGE user_profiles AS target
      USING (SELECT ${supabase_user_id} AS id) AS source
      ON target.supabase_user_id = source.id
      WHEN MATCHED THEN
        UPDATE SET email = ${email}, display_name = ${display_name}
      WHEN NOT MATCHED THEN
        INSERT (supabase_user_id, email, display_name)
        VALUES (${supabase_user_id}, ${email}, ${display_name});
    `;

    return res.json({ success: true, data: result });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
```

## Next Steps

1. ✅ Create SQL schema (done)
2. ✅ Add TypeScript types (done)
3. ✅ Add frontend API functions (done)
4. ⏳ Create backend API endpoints (next)
5. ⏳ Test end-to-end flow
6. ⏳ Add UI for saved code sets
7. ⏳ Add UI for search history

## Troubleshooting

### Cannot connect to Azure SQL
- Verify connection string in `.env`
- Check firewall rules allow your IP
- Ensure database is not paused

### Foreign key constraint errors
- Ensure user_profile exists before creating code sets or search history
- Call `upsertUserProfile` on first login

### JSON parsing errors
- Validate JSON structure before storing
- Use `JSON.stringify()` when saving concepts
- Use `JSON.parse()` when retrieving concepts

## Questions?

Refer to:
- [Azure SQL Documentation](https://docs.microsoft.com/en-us/azure/azure-sql/)
- [Node.js mssql Driver](https://www.npmjs.com/package/mssql)
