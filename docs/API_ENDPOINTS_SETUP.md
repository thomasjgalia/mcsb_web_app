# Backend API Endpoints Setup Guide

This guide explains how to configure and use the user data API endpoints.

## API Endpoints Created

### 1. User Profile Management
**File**: `api/user/profile.ts`

- `POST /api/user/profile` - Create or update user profile
- `GET /api/user/profile/:userId` - Get user profile

### 2. Saved Code Sets
**File**: `api/user/codesets.ts`

- `POST /api/user/codesets` - Save a new code set
- `GET /api/user/codesets/:userId` - Get user's saved code sets (metadata only)
- `GET /api/user/codesets/detail/:codeSetId` - Get full code set details
- `DELETE /api/user/codesets/:codeSetId` - Delete a code set

### 3. Search History
**File**: `api/user/search-history.ts`

- `POST /api/user/search-history` - Track a search
- `GET /api/user/search-history/:userId?limit=10` - Get recent searches

## Setup Instructions

### Step 1: Get Supabase Service Role Key

1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `idnazqdzdnbnoptmqujb`
3. Click **Settings** → **API**
4. Under **Project API keys**, find **service_role** key
5. Copy the key (starts with `eyJ...`)

### Step 2: Update `.env` File

Add the Supabase service role key to `.env`:

```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-actual-key
```

Also add Azure SQL connection details:

```env
AZURE_SQL_SERVER=your-server.database.windows.net
AZURE_SQL_DATABASE=your-database-name
AZURE_SQL_USER=your-username
AZURE_SQL_PASSWORD=your-password
```

**Or use connection string**:

```env
AZURE_SQL_CONNECTION_STRING=Server=your-server.database.windows.net;Database=your-database;User Id=your-username;Password=your-password;Encrypt=true;TrustServerCertificate=true;
```

### Step 3: Update Vercel Environment Variables

For production deployment, add these environment variables to Vercel:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   - `SUPABASE_SERVICE_ROLE_KEY` = (your service role key)
   - `VITE_SUPABASE_URL` = https://idnazqdzdnbnoptmqujb.supabase.co
   - `AZURE_SQL_CONNECTION_STRING` = (your Azure SQL connection string)

### Step 4: Test Locally

Start the dev server:

```bash
npm run dev
```

The API endpoints will be available at:
- `http://localhost:5173/api/user/profile`
- `http://localhost:5173/api/user/codesets`
- `http://localhost:5173/api/user/search-history`

## Authentication Flow

All API endpoints require authentication via Supabase JWT token:

1. **Frontend**: User signs in via Supabase → Gets JWT token
2. **Frontend**: Makes API request with `Authorization: Bearer <token>` header
3. **Backend**: Verifies token using `verifySupabaseToken()`
4. **Backend**: Checks user can only access their own data
5. **Backend**: Executes database query
6. **Backend**: Returns response

## Security Features

1. **JWT Token Verification**: All endpoints verify Supabase JWT tokens
2. **User Authorization**: Users can only access/modify their own data
3. **SQL Injection Prevention**: Uses parameterized queries
4. **Environment Variables**: Sensitive keys stored in `.env` (not in code)

## API Request Examples

### Example 1: Create User Profile (on first login)

```typescript
// Frontend code
import { supabase } from './lib/supabase';
import { upsertUserProfile } from './lib/api';

// After user signs in
const { data: { session } } = await supabase.auth.getSession();
const user = session?.user;

if (user) {
  await upsertUserProfile(user.id, user.email!, 'John Doe');
}
```

### Example 2: Save a Code Set

```typescript
import { saveCodeSet } from './lib/api';

const concepts = shoppingCart; // Array of CartItem from shopping cart

await saveCodeSet(user.id, {
  code_set_name: 'Diabetes Medications',
  description: 'All diabetes drug codes',
  concepts: concepts,
});
```

### Example 3: Get Saved Code Sets

```typescript
import { getSavedCodeSets } from './lib/api';

const savedSets = await getSavedCodeSets(user.id);
console.log('Saved code sets:', savedSets);
```

### Example 4: Track a Search

```typescript
import { trackSearch } from './lib/api';

// After user performs a search
await trackSearch(user.id, 'diabetes', 'Condition', 25);
```

## API Response Format

All endpoints return JSON responses in this format:

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message",
  "code": 400
}
```

## Testing the APIs

### Using curl

**Test User Profile:**
```bash
# Get JWT token from browser console after logging in
curl -X POST http://localhost:5173/api/user/profile \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "supabase_user_id": "your-user-id",
    "email": "test@veradigm.me",
    "display_name": "Test User"
  }'
```

**Test Get Code Sets:**
```bash
curl http://localhost:5173/api/user/codesets/your-user-id \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Using Browser Console

After logging in, get your JWT token:

```javascript
const { data: { session } } = await supabase.auth.getSession();
console.log('JWT Token:', session.access_token);
console.log('User ID:', session.user.id);
```

## Troubleshooting

### Error: "Unauthorized"
- Check JWT token is being sent in Authorization header
- Verify token hasn't expired (tokens expire after 1 hour)
- Check SUPABASE_SERVICE_ROLE_KEY is set correctly

### Error: "Forbidden"
- User trying to access another user's data
- Check supabase_user_id matches authenticated user

### Error: "Connection failed"
- Verify Azure SQL connection string is correct
- Check firewall allows your IP address
- Ensure database is not paused

### Error: "Module not found"
- Run `npm install` in the `api/` directory if needed
- Check all import paths use `.js` extension (TypeScript requirement)

## Next Steps

1. ✅ API endpoints created
2. ⏳ Update `.env` with Supabase service role key
3. ⏳ Update `.env` with Azure SQL credentials
4. ⏳ Test APIs locally
5. ⏳ Integrate into frontend (call APIs on login, search, save code set)
6. ⏳ Deploy to Vercel with environment variables
