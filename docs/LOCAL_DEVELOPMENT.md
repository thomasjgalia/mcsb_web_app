# Local Development Setup

This guide explains how to run the Medical Code Set Builder locally for development and testing.

## Bypassing Authentication for Local Testing

During local development, you can bypass Supabase authentication to focus on testing the core functionality without dealing with login flows.

### How to Disable Auth

1. **Create or edit your `.env` file** in the project root:
   ```bash
   # Copy from example if you haven't already
   cp .env.example .env
   ```

2. **Set the auth bypass flag**:
   ```env
   VITE_DISABLE_AUTH=true
   ```

3. **Restart your dev server**:
   ```bash
   npm run dev
   ```

### What Happens When Auth is Disabled

- **No Login Required**: The app will skip the Supabase authentication page
- **Mock User**: A fake user (`dev@local.test`) is automatically created for the session
- **Full Functionality**: All features work normally - search, hierarchy, cart, code set building
- **No Supabase Calls**: Authentication-related Supabase calls are bypassed

### Re-enabling Authentication

To test with real authentication or prepare for deployment:

1. **Update `.env`**:
   ```env
   VITE_DISABLE_AUTH=false
   ```

2. **Add your Supabase credentials** (if not already present):
   ```env
   VITE_SUPABASE_URL=https://idnazqdzdnbnoptmqujb.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **Restart the dev server**

## Local Development Workflow

### 1. Set Up Oracle Database Connection

Configure your Oracle connection in `.env` (these are NOT prefixed with `VITE_` as they're backend-only):

```env
ORACLE_USER=ADMIN
ORACLE_PASSWORD=your-password
ORACLE_CONNECTION_STRING=your-connection-string
ORACLE_WALLET_LOCATION=C:/path/to/wallet
ORACLE_WALLET_PASSWORD=your-wallet-password
```

### 2. Start Frontend Development Server

```bash
npm run dev
```

This starts Vite on `http://localhost:5173`

### 3. Test API Endpoints Locally

For local API testing, you'll need to run Vercel's dev server:

```bash
npm install -g vercel
vercel dev
```

This will:
- Start the frontend on `http://localhost:3000`
- Run API endpoints at `http://localhost:3000/api/*`
- Load environment variables from `.env`

### 4. Testing Without Full API Setup

If you want to test the UI without connecting to Oracle:

1. Set `VITE_DISABLE_AUTH=true`
2. Run `npm run dev`
3. Mock API responses by modifying `src/lib/api.ts` (temporary):
   ```typescript
   // Add mock data for testing
   export const searchConcepts = async (params: SearchRequest): Promise<SearchResult[]> => {
     // Return mock data instead of real API call
     return [
       {
         standard_name: 'Test Concept',
         std_concept_id: 12345,
         // ... other fields
       }
     ];
   };
   ```

## Common Development Scenarios

### Scenario 1: Testing UI Changes Only
- **Auth**: Disabled (`VITE_DISABLE_AUTH=true`)
- **API**: Mock data in `api.ts`
- **Run**: `npm run dev`

### Scenario 2: Testing API Integration
- **Auth**: Disabled (`VITE_DISABLE_AUTH=true`)
- **API**: Real Oracle connection configured
- **Run**: `vercel dev`

### Scenario 3: Full End-to-End Testing
- **Auth**: Enabled (`VITE_DISABLE_AUTH=false`)
- **API**: Real Oracle connection configured
- **Supabase**: Real credentials in `.env`
- **Run**: `vercel dev`

### Scenario 4: Production-like Testing
- **Auth**: Enabled with real Supabase
- **API**: Real Oracle connection
- **Run**: Deploy to Vercel staging environment

## Environment Variables Reference

### Frontend Variables (prefixed with `VITE_`)
These are exposed to the browser:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key (safe to expose)
- `VITE_DISABLE_AUTH` - Set to 'true' to bypass authentication

### Backend Variables (NO `VITE_` prefix)
These are server-side only and never exposed to the browser:
- `ORACLE_USER` - Oracle database username
- `ORACLE_PASSWORD` - Oracle database password
- `ORACLE_CONNECTION_STRING` - Oracle connection string
- `ORACLE_WALLET_LOCATION` - Path to Oracle wallet (for secure connections)
- `ORACLE_WALLET_PASSWORD` - Oracle wallet password

## Important Notes

⚠️ **Never commit `.env` to git** - it contains sensitive credentials

⚠️ **Never enable `VITE_DISABLE_AUTH=true` in production** - this is for local development only

⚠️ **Oracle credentials should never have `VITE_` prefix** - they must remain server-side

✅ **Always test with auth enabled** before deploying to production

## Troubleshooting

### Issue: "Supabase URL is not set"
**Solution**: Either add real Supabase credentials OR set `VITE_DISABLE_AUTH=true`

### Issue: API calls fail with 500 error
**Solution**: Check Oracle connection settings in `.env` (without `VITE_` prefix)

### Issue: Changes to `.env` not taking effect
**Solution**: Restart the dev server (`Ctrl+C` then `npm run dev` or `vercel dev`)

### Issue: Auth bypass not working
**Solution**: Ensure you have `VITE_DISABLE_AUTH=true` (not 'True' or '1', must be 'true')

## Next Steps

Once you've tested locally and confirmed everything works:

1. Set `VITE_DISABLE_AUTH=false` in production `.env`
2. Add all environment variables to Vercel project settings
3. Deploy to Vercel
4. Test the production deployment with real authentication
