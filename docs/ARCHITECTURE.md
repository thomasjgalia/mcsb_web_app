# Medical Code Set Builder - Architecture & Technical Approach
## Production Implementation Documentation

---

## Executive Summary

The Medical Code Set Builder is a production web application that enables healthcare researchers and data analysts to build comprehensive medical code sets from OMOP vocabulary data. The application features a dual-workflow approach (Hierarchical and Direct Build), intelligent domain-specific recommendations, and a streamlined shopping cart system for managing multiple concepts.

**Live Application:** Deployed on Vercel with Azure SQL Database backend and Supabase authentication.

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (Browser)                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  React 18 + TypeScript + Vite + Tailwind CSS          │ │
│  │  - Workflow Selection (Hierarchical/Direct)            │ │
│  │  - Step 1: Search & Filter                             │ │
│  │  - Step 2: Hierarchy Exploration (Hierarchical only)   │ │
│  │  - Step 3: Code Set Building & Export                  │ │
│  │  - Shopping Cart (Persistent State)                    │ │
│  │  - Saved Code Sets Management                          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              VERCEL SERVERLESS FUNCTIONS (API)               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  /api/search        - Step 1 concept search            │ │
│  │  /api/hierarchy     - Step 2 hierarchy traversal       │ │
│  │  /api/codeset       - Step 3 code set generation       │ │
│  │  /api/testConnection - Database health check           │ │
│  │  /api/user/codesets - Saved code sets CRUD             │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
              │                                    │
              │ mssql (TDS)                        │ Supabase Client
              ▼                                    ▼
┌──────────────────────────┐       ┌──────────────────────────┐
│   AZURE SQL DATABASE     │       │    SUPABASE (Auth)       │
│  ┌────────────────────┐  │       │  ┌────────────────────┐  │
│  │ OMOP Vocabulary:   │  │       │  │ - User Auth        │  │
│  │ - CONCEPT          │  │       │  │   (Magic Links)    │  │
│  │ - CONCEPT_ANCESTOR │  │       │  │ - Row-Level        │  │
│  │ - CONCEPT_         │  │       │  │   Security         │  │
│  │   RELATIONSHIP     │  │       │  │ - Saved Code Sets  │  │
│  │ - CONCEPT_         │  │       │  │   Storage          │  │
│  │   ATTRIBUTE        │  │       │  └────────────────────┘  │
│  └────────────────────┘  │       └──────────────────────────┘
└──────────────────────────┘
```

---

## Technology Stack

### Frontend
- **Framework:** React 18.3.1 with TypeScript 5.9.3
- **Build Tool:** Vite 5.4.21
- **Styling:** Tailwind CSS 3.x
- **Routing:** React Router v6
- **Icons:** Lucide React
- **State Management:** React Hooks (useState, useEffect)
- **HTTP Client:** Native fetch API with async/await

### Backend
- **Runtime:** Node.js (Vercel Serverless Functions)
- **Database Driver:** mssql (TDS protocol)
- **Authentication:** Supabase Auth (@supabase/supabase-js)
- **API Type Safety:** TypeScript with @vercel/node types

### Database
- **Primary Database:** Azure SQL Database (OMOP Vocabulary)
  - Read-only access to ~6GB of OMOP vocabulary data
  - Tables: CONCEPT, CONCEPT_ANCESTOR, CONCEPT_RELATIONSHIP, CONCEPT_ATTRIBUTE
- **User Database:** Supabase PostgreSQL
  - User authentication and session management
  - Saved code sets storage with Row-Level Security

### Deployment
- **Platform:** Vercel
- **CI/CD:** Automatic deployment on git push to main branch
- **Environment:** Production environment variables stored in Vercel

---

## Application Workflows

### Workflow Selection (Landing Page)

The application presents users with two distinct workflow options:

#### 1. Hierarchical Build Workflow
**Best For:** Condition and Drug domains
- **Step 1:** Search and filter concepts
- **Step 2:** Explore hierarchy (ancestors/descendants) with re-anchoring capability
- **Step 3:** Build comprehensive code sets with all descendants

**Use Cases:**
- Building condition-based cohorts (e.g., "All types of diabetes")
- Drug class-based code sets (e.g., "All beta blockers")
- Scenarios requiring complete hierarchical expansion

#### 2. Direct Build Workflow
**Best For:** Procedure, Measurement, Observation, and Device domains
- **Step 1:** Search and filter concepts (with enhanced filtering)
- **Step 3:** Build exact code sets from selected concepts (no hierarchy expansion)

**Use Cases:**
- Specific procedure lists (e.g., "Hip replacement procedures")
- Precise measurement sets (e.g., "A1C lab tests")
- Device-specific code sets

---

## Detailed Component Architecture

### Step 1: Search & Filter (`Step1Search.tsx`)

**Purpose:** Find and select OMOP concepts across domains

**Key Features:**
1. **Domain-Specific Search**
   - Required domain selection: Condition, Drug, Procedure, Measurement, Observation, Device
   - Domain highlighting based on workflow (bold text for recommended domains)
   - Minimum 2-character search term validation

2. **Dynamic Filtering**
   - Vocabulary filter (e.g., SNOMED, ICD10CM, RxNorm)
   - Concept class filter (e.g., Clinical Finding, Ingredient)
   - Text-based result filtering
   - Filter chips with counts

3. **Result Table**
   - Sortable columns (↑↓ indicators)
   - Conditional column widths (Direct Build shows searched concept prominently)
   - Color coding for rows (highlights matches)
   - Responsive design with horizontal scroll on mobile

4. **Actions**
   - **Hierarchical Workflow:** "Hierarchy" button → Step 2
   - **Direct Workflow:** "Add" button → Shopping Cart (toggleable add/remove)
   - "Add All" / "Remove All" buttons for filtered results
   - "Go to Build" button when cart has items

**API Endpoint:** `POST /api/search`
```typescript
Request: { searchterm: string, domain_id: DomainType }
Response: SearchResult[] (up to 75 results)
```

**SQL Query:** `Step_1_TermSearch.sql`
- Searches across CONCEPT table
- Maps non-standard concepts to standard concepts
- Returns both searched and standard concept metadata

---

### Step 2: Hierarchy Exploration (`Step2Hierarchy.tsx`)

**Purpose:** Visualize and navigate concept hierarchies (Hierarchical Workflow only)

**Key Features:**
1. **Three-Section Display**
   - **Ancestors:** Parent concepts (steps_away > 0) - Collapsible by default
   - **Selected Concept:** Anchor point (steps_away = 0) - Always visible
   - **Descendants:** Child concepts (steps_away < 0) - Collapsible by default

2. **Re-anchoring Capability**
   - Click "Re-anchor" on any row to pivot the hierarchy view
   - Useful for exploring different levels of granularity

3. **Concept Class Filtering**
   - Filter hierarchy by concept class (e.g., "Ingredient" for drugs)
   - Shows counts per class

4. **Visual Indicators**
   - Color-coded badges for steps away from anchor
   - Highlighted rows for important classes (Ingredient, Lab Test)
   - Ancestor/Descendant icons with chevrons

5. **Add to Cart**
   - Add any concept from the hierarchy to the shopping cart
   - Immediate feedback with "Added" state
   - Auto-navigation to Step 3 after adding

**API Endpoint:** `POST /api/hierarchy`
```typescript
Request: { concept_id: number }
Response: HierarchyResult[] (ancestors, self, descendants)
```

**SQL Query:** `Step_2_ExploreHierarchy.sql`
- Uses CONCEPT_ANCESTOR table for hierarchy traversal
- Calculates steps_away (distance from anchor concept)
- Returns all ancestors and descendants

---

### Step 3: Code Set Building (`Step3CodeSet.tsx`)

**Purpose:** Generate comprehensive code sets from shopping cart concepts

**Key Features:**
1. **Build Controls**
   - Drug Filter (Hierarchical only): ALL / SINGLE / COMBINATION
   - Build/Rebuild buttons
   - Shows current workflow type (Hierarchical/Direct)

2. **Results Table**
   - Displays all descendant codes for Hierarchical Build
   - Displays exact selected codes for Direct Build
   - Columns: Root Concept, Vocabulary, Code, Name, Concept ID, Class
   - Drug-specific columns: Combination Y/N, Dose Form, DFG Name
   - Sortable columns
   - Pagination controls (50 rows per page)

3. **Export Options**
   - **Tab-Delimited TXT:** Vocabulary | Code | Name format
   - **SQL Snippet:** Generates WHERE clause with IN conditions grouped by vocabulary
   - **CSV Export:** All columns including metadata
   - Filename format: `codeset_YYYYMMDD_HHmmss.txt`

4. **Save Functionality**
   - Save code set with custom name
   - Persists to Supabase for logged-in users
   - Shows save dialog with timestamp

5. **Deduplication**
   - Automatic deduplication based on: vocabulary_id, code, name, concept_id, class
   - Prevents duplicate codes when multiple root concepts have overlapping descendants
   - Logs before/after counts in console

**API Endpoint:** `POST /api/codeset`
```typescript
Request: {
  concept_ids: number[],
  combo_filter?: 'ALL' | 'SINGLE' | 'COMBINATION',
  build_type?: 'hierarchical' | 'direct'
}
Response: { success: boolean, data: CodeSetResult[] }
```

**SQL Queries:**
- **Hierarchical:** `Step_3_Build_Code_Set.sql` (complex hierarchy expansion)
- **Direct:** Simple SELECT from CONCEPT table (no expansion)

**Build Process:**
1. **Hierarchical Build:**
   - For each concept in cart, execute hierarchy query
   - Apply domain-specific vocabulary filters
   - Combine all results
   - Deduplicate across all concepts

2. **Direct Build:**
   - Single query with `IN` clause for all cart concept IDs
   - No hierarchy traversal
   - Returns exact concepts only

---

### Shopping Cart (`ShoppingCart.tsx`)

**Purpose:** Manage selected concepts across workflows

**Key Features:**
1. **Slide-out Panel**
   - Opens from right side
   - Overlay with backdrop
   - Close button (X) and click-outside-to-close

2. **Cart Display**
   - Shows concept name, ID, vocabulary, class, domain
   - Individual remove (X) button per item
   - "Clear Cart" button to empty all

3. **Domain Intelligence**
   - Detects mixed domains in cart
   - Shows workflow recommendations:
     - "Direct Build recommended" for non-hierarchical domains only
     - "Hierarchical Build recommended" for Condition/Drug only
     - Warning for mixed domains

4. **Build Navigation**
   - "Build Code Set" button navigates to Step 3
   - Shows item count in cart badge
   - Disabled when cart is empty

5. **State Persistence**
   - Cart persists across navigation
   - Survives page refreshes (React state)
   - Cleared only by explicit "Clear Cart" or "Start Over"

**Cart Item Structure:**
```typescript
interface CartItem {
  hierarchy_concept_id: number;
  concept_name: string;
  vocabulary_id: string;
  concept_class_id: string;
  root_term: string;
  domain_id: DomainType;
}
```

---

### Navigation (`Navigation.tsx`)

**Purpose:** Workflow progress and global navigation

**Key Features:**
1. **Workflow Badge**
   - Shows current workflow: "Hierarchical Build" or "Direct Build"
   - Color-coded: blue for Hierarchical, green for Direct

2. **Step Indicators**
   - Step 1: Search (magnifying glass icon)
   - Step 2: Hierarchy (branch icon) - Hierarchical only
   - Step 3: Build (package icon)
   - Visual separator (chevron) between steps
   - Grayed out for disabled steps

3. **Global Actions**
   - **Home Button:** Returns to workflow selection, clears all state
   - **Cart Badge:** Shows item count, opens cart on click
   - **AI Assistant:** (Placeholder for future enhancement)
   - **UMLS Search:** External link to UMLS browser

4. **Step Navigation**
   - Click steps to navigate (when enabled)
   - Current step highlighted
   - Disabled steps are non-clickable

---

### Saved Code Sets (`SavedCodeSets.tsx`)

**Purpose:** Manage previously saved code sets

**Key Features:**
1. **Code Set List**
   - Displays all saved code sets for logged-in user
   - Shows name, concept count, and creation date
   - Sortable by date or name

2. **Actions Per Code Set**
   - **View:** Preview concepts in the code set
   - **Download:** Export as TXT/CSV
   - **Rebuild:** Load concepts into cart and rebuild
   - **Delete:** Remove from saved sets (with confirmation)
   - **Edit Name:** Rename the code set

3. **Back Navigation**
   - Back button returns to previous screen
   - Uses browser history (`navigate(-1)`)

4. **Data Persistence**
   - Stored in Supabase with Row-Level Security
   - Only accessible by the user who created them
   - Includes concept IDs, build settings, and metadata

**API Endpoint:** `GET /api/user/codesets`
```typescript
Response: { success: boolean, data: SavedCodeSet[] }
```

---

## Database Architecture

### Azure SQL Database (OMOP Vocabulary)

**Connection Configuration:**
```typescript
const config = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectionTimeout: 30000,
    requestTimeout: 60000
  }
};
```

**Key Tables:**

1. **CONCEPT** (~6M rows)
   - Primary vocabulary table
   - Columns: concept_id (PK), concept_name, vocabulary_id, concept_code, domain_id, concept_class_id
   - Indexes: concept_id, vocabulary_id, concept_code, domain_id

2. **CONCEPT_ANCESTOR** (~500M rows)
   - Hierarchical relationships
   - Columns: ancestor_concept_id, descendant_concept_id, min_levels_of_separation
   - Indexes: ancestor_concept_id, descendant_concept_id

3. **CONCEPT_RELATIONSHIP** (~100M rows)
   - Relationships between concepts (Maps to, Subsumes, etc.)
   - Columns: concept_id_1, concept_id_2, relationship_id
   - Indexes: concept_id_1, concept_id_2, relationship_id

4. **CONCEPT_ATTRIBUTE** (~5M rows)
   - Additional concept metadata
   - Columns: concept_id, concept_attribute, value
   - Used for drug properties, measurements

**Query Optimization:**
- All queries use parameterized statements (SQL injection prevention)
- Appropriate indexes on frequently queried columns
- Query timeout: 60 seconds
- Result limits: 75 rows (Step 1), unlimited (Step 2/3 with pagination)

---

### Supabase (User Data)

**Authentication:**
- Magic link email authentication (passwordless)
- JWT-based session management
- Automatic token refresh

**Tables:**

1. **saved_code_sets**
   ```sql
   CREATE TABLE saved_code_sets (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID REFERENCES auth.users NOT NULL,
     name TEXT NOT NULL,
     concept_ids BIGINT[] NOT NULL,
     build_type TEXT NOT NULL,
     combo_filter TEXT,
     created_at TIMESTAMP DEFAULT NOW(),
     result_count INTEGER,
     metadata JSONB
   );
   ```

2. **Row-Level Security:**
   ```sql
   ALTER TABLE saved_code_sets ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Users can only access their own code sets"
     ON saved_code_sets FOR ALL
     USING (auth.uid() = user_id);
   ```

---

## API Endpoints

### Search API (`/api/search`)
**Method:** POST
**Purpose:** Search OMOP concepts by term and domain
**Request:**
```typescript
{
  searchterm: string;  // min 2 chars
  domain_id: 'Condition' | 'Drug' | 'Procedure' | 'Measurement' | 'Observation' | 'Device';
}
```
**Response:**
```typescript
{
  success: boolean;
  data: SearchResult[];
  error?: string;
}
```
**Processing:**
- Validates input (min length, domain required)
- Parameterizes SQL query
- Maps non-standard concepts to standard concepts
- Limits results to 75 rows
- Tracks search in database for analytics

---

### Hierarchy API (`/api/hierarchy`)
**Method:** POST
**Purpose:** Get ancestors and descendants of a concept
**Request:**
```typescript
{
  concept_id: number;
}
```
**Response:**
```typescript
{
  success: boolean;
  data: HierarchyResult[];
}
```
**Processing:**
- Uses CONCEPT_ANCESTOR for hierarchy traversal
- Calculates steps_away (positive = parent, negative = child)
- Returns full hierarchy (no pagination)
- Includes vocabulary and class metadata

---

### Code Set API (`/api/codeset`)
**Method:** POST
**Purpose:** Generate code sets from concept IDs
**Request:**
```typescript
{
  concept_ids: number[];
  combo_filter?: 'ALL' | 'SINGLE' | 'COMBINATION';
  build_type?: 'hierarchical' | 'direct';
}
```
**Response:**
```typescript
{
  success: boolean;
  data: CodeSetResult[];
}
```
**Processing:**
1. **Hierarchical Build:**
   - For each concept_id, get domain
   - Apply domain-specific vocabulary filters:
     - Condition: ICD10CM, SNOMED, ICD9CM
     - Drug: RxNorm, NDC, CPT4, CVX, HCPCS, ATC
     - Observation: ICD10CM, SNOMED, LOINC, CPT4, HCPCS
     - Measurement: LOINC, CPT4, SNOMED, HCPCS
     - Procedure: CPT4, HCPCS, SNOMED, ICD09PCS, LOINC, ICD10PCS
   - Expand hierarchy to get all descendants
   - Apply combo filter (drugs only)
   - Combine results from all concepts

2. **Direct Build:**
   - Single query with `IN` clause
   - No hierarchy expansion
   - No domain-specific filtering
   - Returns exact concepts only

3. **Deduplication:**
   - Applied to both build types
   - Key: `vocabulary_id|code|name|concept_id|class`
   - Logs before/after counts

---

### Test Connection API (`/api/testConnection`)
**Method:** GET
**Purpose:** Health check for database connectivity
**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```
**Used By:** Landing page on initial load (single check on app startup)

---

### User Code Sets API (`/api/user/codesets`)
**Methods:** GET, POST, DELETE
**Purpose:** CRUD operations for saved code sets

**GET:** List all saved code sets for user
**POST:** Save new code set
```typescript
{
  name: string;
  concept_ids: number[];
  build_type: 'hierarchical' | 'direct';
  combo_filter?: string;
  result_count: number;
}
```
**DELETE:** Remove saved code set by ID

---

## Key Implementation Details

### State Management

**Global State (App.tsx):**
- `user`: Supabase authenticated user
- `workflow`: 'direct' | 'hierarchical' | null
- `currentStep`: 0 | 1 | 2 | 3
- `shoppingCart`: CartItem[]
- `searchResults`: SearchResult[]
- `selectedConcept`: SearchResult | null
- `dbConnectionStatus`: Database health status

**State Persistence:**
- Shopping cart persists across navigation
- Search results cached during session
- Workflow selection locked until "Start Over"
- Database connection checked once on app startup

---

### Domain Intelligence

**Domain Classification:**
```typescript
// Hierarchical domains
const hierarchicalDomains = ['Condition', 'Drug'];

// Direct build domains
const directDomains = ['Procedure', 'Measurement', 'Observation', 'Device'];
```

**Highlighting Logic:**
- In domain dropdown, bold/emphasize domains that match current workflow
- In helper text, mention appropriate domains for current workflow
- In shopping cart, warn about mixed domains

**Vocabulary Filters by Domain (Hierarchical Build):**
- Ensures relevant code systems are included
- Example: Condition → ICD10CM, SNOMED, ICD9CM
- Example: Drug → RxNorm, NDC, CPT4, CVX, HCPCS, ATC

---

### Deduplication Strategy

**Problem:** When building hierarchical code sets from multiple root concepts, overlapping descendants create duplicates.

**Solution:**
```typescript
function deduplicateResults(results: CodeSetResult[]): CodeSetResult[] {
  const seen = new Map<string, CodeSetResult>();

  for (const result of results) {
    const key = `${result.child_vocabulary_id}|${result.child_code}|${result.child_name}|${result.child_concept_id}|${result.concept_class_id}`;

    if (!seen.has(key)) {
      seen.set(key, result);
    }
  }

  return Array.from(seen.values());
}
```

**Applied To:**
- Hierarchical Build: After combining results from all root concepts
- Direct Build: After querying all selected concepts
- Logs: Console shows "Deduplicated from X to Y unique concepts"

---

### Export Formats

#### 1. Tab-Delimited TXT
**Format:**
```
Vocabulary_ID	Code	Name
SNOMED	15989271000119107	Conjunctivitis of right eye caused by herpes zoster virus
ICD10CM	B02.30	Zoster ocular disease, unspecified
```

**Implementation:**
```typescript
const content = results
  .map(r => `${r.child_vocabulary_id}\t${r.child_code}\t${r.child_name}`)
  .join('\n');
```

#### 2. SQL Snippet
**Format:**
```sql
VOCABULARY_ID = 'SNOMED' AND CODE IN ('15989271000119107','15989351000119108')
OR VOCABULARY_ID = 'ICD9CM' AND CODE IN ('053.8','053')
OR VOCABULARY_ID = 'ICD10CM' AND CODE IN ('B02.8','B02','B02.3','B02.30')
```

**Implementation:**
- Group results by vocabulary_id
- Generate IN clause per vocabulary
- Join with OR operators
- Copy to clipboard

#### 3. CSV Export
**Format:** All columns including metadata
- Includes drug-specific fields (dose form, combination, dfg_name)
- Includes root concept name for traceability

---

## Performance Optimizations

### Frontend
1. **Lazy Loading:** Components loaded on-demand (React.lazy)
2. **Debouncing:** Search input debounced at 300ms
3. **Pagination:** Step 3 results paginated at 50 rows/page
4. **Memoization:** Expensive calculations cached with useMemo
5. **Virtualization:** Large tables use virtual scrolling (if needed)

### Backend
1. **Connection Pooling:** mssql uses built-in connection pooling
2. **Query Timeouts:** 60-second timeout prevents hanging
3. **Parameterized Queries:** Prevents SQL injection, improves query plan caching
4. **Indexed Columns:** All frequently queried columns have indexes
5. **Result Limits:** Step 1 limited to 75 rows

### Database
1. **Indexes:**
   - CONCEPT: concept_id (PK), vocabulary_id, concept_code, domain_id
   - CONCEPT_ANCESTOR: ancestor_concept_id, descendant_concept_id
   - CONCEPT_RELATIONSHIP: concept_id_1, concept_id_2, relationship_id

2. **Query Optimization:**
   - Use EXISTS instead of IN where possible
   - Avoid SELECT * (specify columns)
   - Limit joins to necessary tables

---

## Security Implementation

### API Security
1. **CORS:** Configured to allow requests from Vercel domain only
2. **Environment Variables:** All credentials stored securely in Vercel
3. **SQL Injection Prevention:** Parameterized queries throughout
4. **Rate Limiting:** Vercel's built-in rate limiting (100 req/10s per IP)

### Authentication
1. **Supabase Auth:** JWT-based authentication
2. **Magic Links:** Passwordless email authentication
3. **Row-Level Security:** Users can only access their own saved code sets
4. **Session Management:** Automatic token refresh

### Database
1. **Read-Only Access:** OMOP vocabulary user has SELECT-only permissions
2. **Connection Encryption:** TLS/SSL for all database connections
3. **Credential Management:** Azure SQL credentials in environment variables

---

## Error Handling

### API Error Responses
```typescript
{
  success: false,
  error: "User-friendly error message"
}
```

### Frontend Error Handling
1. **Network Errors:** Show retry button
2. **API Errors:** Display error message in alert box
3. **Validation Errors:** Inline error messages near form fields
4. **Loading States:** Spinners during async operations
5. **Empty States:** Friendly messages when no results

### Logging
- Server: Console logs for debugging (visible in Vercel logs)
- Client: Console errors for development debugging
- Database: Query errors logged with sanitized parameters

---

## Deployment Architecture

### Vercel Configuration

**Build Settings:**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "framework": "vite"
}
```

**Environment Variables (Production):**
```
AZURE_SQL_SERVER=your-server.database.windows.net
AZURE_SQL_DATABASE=your-database
AZURE_SQL_USER=your-user
AZURE_SQL_PASSWORD=your-password
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Serverless Functions:**
- Auto-detected in `/api` directory
- Each file becomes a serverless endpoint
- Node.js runtime, cold start optimized

### CI/CD Pipeline
1. **Trigger:** Push to main branch
2. **Build:** Vercel runs `npm run build`
3. **Deploy:** Automatic deployment to production
4. **Rollback:** Previous deployments available for instant rollback

---

## Testing Strategy

### Manual Testing Checklist
- [x] Workflow selection works for both types
- [x] Domain dropdown highlights correct domains
- [x] Search returns results for all 6 domains
- [x] Vocabulary and class filters work correctly
- [x] Add/Remove cart buttons toggle correctly
- [x] Hierarchy view shows ancestors/descendants
- [x] Re-anchoring updates hierarchy correctly
- [x] Collapsible sections (Ancestors/Descendants) work
- [x] Code set builds successfully for hierarchical workflow
- [x] Code set builds successfully for direct workflow
- [x] Deduplication removes duplicate codes
- [x] TXT export downloads with correct format
- [x] SQL snippet copies to clipboard
- [x] CSV export includes all columns
- [x] Saved code sets persist for logged-in users
- [x] Navigation (Home button) clears state and returns to landing
- [x] Back button from Saved Code Sets works

### Edge Cases Tested
- Empty search results → Friendly message displayed
- No hierarchy found → Warning message
- Cart with 10+ items → Scrollable cart panel
- Very large code set results (5000+ rows) → Pagination working
- Mixed domains in cart → Warning displayed
- Network timeout → Retry button shown
- Database connection failure → Error message with retry

---

## Future Enhancements

### Planned Features (Post-MVP)
1. **Code Set Comparison:** Diff two saved code sets
2. **Bulk Import:** Upload CSV of concept IDs
3. **Hierarchy Visualization:** Interactive tree diagram
4. **Excel Export:** Multi-sheet workbook with metadata
5. **Share Code Sets:** Generate shareable links
6. **Admin Panel:** User management dashboard
7. **Search History:** Recently searched terms with quick re-search
8. **Favorites:** Star frequently used concepts
9. **Batch Operations:** Apply actions to multiple saved code sets
10. **API Access:** REST API for programmatic access

### Technical Debt
1. Add unit tests for utility functions
2. Add integration tests for API endpoints
3. Implement proper error boundaries in React
4. Add Sentry or similar for error tracking
5. Optimize bundle size (currently ~800KB)
6. Add service worker for offline capability
7. Implement proper caching strategy (Redis or similar)

---

## Monitoring & Observability

### Current Monitoring
- **Vercel Analytics:** Page views, performance metrics
- **Vercel Logs:** Serverless function logs, errors
- **Console Logging:** Development debugging

### Recommended Additions
1. **Error Tracking:** Sentry for production error monitoring
2. **Performance Monitoring:** Web Vitals tracking
3. **Database Monitoring:** Azure SQL query performance insights
4. **User Analytics:** Mixpanel or Amplitude for usage patterns
5. **Uptime Monitoring:** Pingdom or UptimeRobot

---

## Success Metrics

### Performance Targets
- [x] Application loads in <3 seconds
- [x] Search returns results in <2 seconds
- [x] Hierarchy loads in <3 seconds
- [x] Code set builds in <10 seconds (for 5 concepts)
- [x] Exports generate in <1 second

### User Experience
- [x] Mobile responsive (works on tablets and phones)
- [x] Works in Chrome, Firefox, Safari, Edge
- [x] Intuitive workflow with minimal training
- [x] Clear error messages and loading states
- [x] Accessible (keyboard navigation, screen reader friendly)

### Reliability
- [x] 99%+ uptime (Vercel SLA)
- [x] No data loss for saved code sets
- [x] Graceful degradation on errors
- [x] Automatic session recovery

---

## Conclusion

The MCSB Oracle Code Set Builder successfully implements a dual-workflow approach for building medical code sets from OMOP vocabulary data. The architecture leverages modern web technologies (React, TypeScript, Vercel) with a scalable Azure SQL backend and secure Supabase authentication.

Key achievements:
- **Intuitive UX:** Workflow selection, smart domain recommendations, persistent shopping cart
- **Performance:** Fast queries with proper indexing and deduplication
- **Scalability:** Serverless architecture handles variable load
- **Security:** Parameterized queries, Row-Level Security, encrypted connections
- **Maintainability:** TypeScript for type safety, modular component architecture

The application is production-ready and actively used for building comprehensive medical code sets across all OMOP domains.

---

**Document Version:** 1.0
**Last Updated:** January 2026
**Maintained By:** Development Team
