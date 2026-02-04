# Frontend Integration Guide

This guide shows how to integrate the user data APIs into the React frontend.

## Overview

The frontend API client functions are already created in `src/lib/api.ts`. You just need to call them at the right places in your app.

## Integration Points

### 1. Create User Profile on First Login

**File**: `src/App.tsx`

Add this to the `useEffect` that checks for existing session:

```typescript
useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    setUser(session?.user ?? null);

    // Create/update user profile on login
    if (session?.user) {
      upsertUserProfile(
        session.user.id,
        session.user.email!,
        session.user.user_metadata?.display_name
      ).catch(err => console.error('Failed to create user profile:', err));
    }

    setLoading(false);
  });

  // ... rest of the code
}, [authDisabled]);
```

Don't forget to import:
```typescript
import { upsertUserProfile } from './lib/api';
```

### 2. Track Searches in Step 1

**File**: `src/components/Step1Search.tsx`

After a successful search, track it:

```typescript
// After fetching search results
const handleSearch = async () => {
  setLoading(true);
  setError(null);

  try {
    const results = await searchConcepts({
      searchterm: searchTerm,
      domain_id: selectedDomain!,
    });

    setSearchResults(results);

    // Track the search (don't await, fire and forget)
    const user = (await supabase.auth.getSession()).data.session?.user;
    if (user) {
      trackSearch(user.id, searchTerm, selectedDomain, results.length)
        .catch(err => console.error('Failed to track search:', err));
    }
  } catch (err) {
    // ... error handling
  } finally {
    setLoading(false);
  }
};
```

Import:
```typescript
import { trackSearch } from '../lib/api';
import { supabase } from '../lib/supabase';
```

### 3. Save Code Set in Step 3

**File**: `src/components/Step3CodeSet.tsx`

Add a "Save Code Set" button:

```typescript
import { useState } from 'react';
import { saveCodeSet } from '../lib/api';
import { supabase } from '../lib/supabase';

// Inside component
const [saving, setSaving] = useState(false);
const [saveSuccess, setSaveSuccess] = useState(false);

const handleSaveCodeSet = async () => {
  const codeSetName = prompt('Enter a name for this code set:');

  if (!codeSetName) return;

  setSaving(true);
  setSaveSuccess(false);

  try {
    const user = (await supabase.auth.getSession()).data.session?.user;

    if (!user) {
      throw new Error('Not authenticated');
    }

    // Convert shopping cart to SavedCodeSetConcept format
    const concepts = shoppingCart.map(item => ({
      hierarchy_concept_id: item.hierarchy_concept_id,
      concept_name: item.concept_name,
      vocabulary_id: item.vocabulary_id,
      concept_class_id: item.concept_class_id,
      root_term: item.root_term,
      domain_id: item.domain_id,
    }));

    await saveCodeSet(user.id, {
      code_set_name: codeSetName,
      description: `Saved on ${new Date().toLocaleDateString()}`,
      concepts: concepts,
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  } catch (error) {
    console.error('Failed to save code set:', error);
    alert('Failed to save code set. Please try again.');
  } finally {
    setSaving(false);
  }
};

// Add button in JSX (near export buttons)
<button
  onClick={handleSaveCodeSet}
  disabled={saving || codeSetResults.length === 0}
  className="btn-secondary flex items-center gap-2"
>
  <Save className="w-5 h-5" />
  {saving ? 'Saving...' : saveSuccess ? '✓ Saved!' : 'Save Code Set'}
</button>
```

### 4. Add JWT Token to API Requests

**File**: `src/lib/api.ts`

Update the `apiClient` to automatically include JWT token:

```typescript
import { supabase } from './supabase';

// Add request interceptor to include JWT token
apiClient.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }

  return config;
});
```

Add this code right after creating the `apiClient` instance (around line 25).

### 5. Display Saved Code Sets (Optional)

Create a new component to show user's saved code sets:

**File**: `src/components/SavedCodeSets.tsx`

```typescript
import { useState, useEffect } from 'react';
import { getSavedCodeSets, getCodeSetDetail, deleteCodeSet } from '../lib/api';
import type { GetCodeSetsResponse } from '../lib/types';
import { supabase } from '../lib/supabase';

export default function SavedCodeSets() {
  const [codeSets, setCodeSets] = useState<GetCodeSetsResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCodeSets();
  }, []);

  const loadCodeSets = async () => {
    try {
      const user = (await supabase.auth.getSession()).data.session?.user;
      if (!user) return;

      const sets = await getSavedCodeSets(user.id);
      setCodeSets(sets);
    } catch (error) {
      console.error('Failed to load code sets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this code set?')) return;

    const success = await deleteCodeSet(id);
    if (success) {
      setCodeSets(codeSets.filter(cs => cs.id !== id));
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">Saved Code Sets</h2>

      {codeSets.length === 0 ? (
        <p className="text-gray-500">No saved code sets yet.</p>
      ) : (
        <div className="space-y-3">
          {codeSets.map(codeSet => (
            <div key={codeSet.id} className="border rounded-lg p-4 flex justify-between items-center">
              <div>
                <h3 className="font-semibold">{codeSet.code_set_name}</h3>
                <p className="text-sm text-gray-600">
                  {codeSet.total_concepts} concepts · {new Date(codeSet.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => handleDelete(codeSet.id)}
                className="btn-secondary text-sm"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 6. Display Search History (Optional)

**File**: `src/components/RecentSearches.tsx`

```typescript
import { useState, useEffect } from 'react';
import { getSearchHistory } from '../lib/api';
import type { SearchHistoryRecord } from '../lib/types';
import { supabase } from '../lib/supabase';

export default function RecentSearches() {
  const [searches, setSearches] = useState<SearchHistoryRecord[]>([]);

  useEffect(() => {
    loadSearchHistory();
  }, []);

  const loadSearchHistory = async () => {
    try {
      const user = (await supabase.auth.getSession()).data.session?.user;
      if (!user) return;

      const history = await getSearchHistory(user.id, 5);
      setSearches(history);
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  };

  if (searches.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold text-sm text-gray-700 mb-2">Recent Searches</h3>
      <div className="space-y-1">
        {searches.map(search => (
          <div key={search.id} className="text-sm text-gray-600">
            {search.search_term}
            {search.domain_type && ` (${search.domain_type})`}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Testing Integration

1. **Start dev server**: `npm run dev`
2. **Sign in** to the app
3. **Open browser console** - You should see user profile creation
4. **Perform a search** - Check console for search tracking
5. **Build a code set and save it** - Try the Save button
6. **Check Azure SQL** - Verify data is being stored

## Environment Variables Checklist

Before testing, ensure these are set in `.env`:

- [x] `VITE_SUPABASE_URL`
- [x] `VITE_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (get from Supabase Dashboard)
- [ ] `AZURE_SQL_CONNECTION_STRING` (your Azure SQL connection)

## Deployment Checklist

Before deploying to Vercel:

1. [ ] Add all environment variables to Vercel Dashboard
2. [ ] Test authentication flow in production
3. [ ] Verify API endpoints are accessible
4. [ ] Test saving code sets
5. [ ] Test loading saved code sets

## Optional Enhancements

1. **Add loading states** - Show spinners while saving
2. **Add success notifications** - Toast messages for saved code sets
3. **Add error handling** - User-friendly error messages
4. **Add retry logic** - Auto-retry failed API calls
5. **Add offline support** - Queue API calls when offline
6. **Add pagination** - For large lists of saved code sets

## Questions?

Refer to:
- [API_ENDPOINTS_SETUP.md](API_ENDPOINTS_SETUP.md) - Backend API setup
- [AZURE_SQL_SETUP.md](AZURE_SQL_SETUP.md) - Database setup
- [src/lib/api.ts](src/lib/api.ts) - Frontend API client
