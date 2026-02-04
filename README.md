# Medical Code Set Builder - Oracle Cloud Edition

A web-based OMOP vocabulary code set builder with a shopping cart workflow. Search medical concepts, explore hierarchies, and generate comprehensive code sets across multiple vocabularies.

## Tech Stack

### Frontend
- **React 18** + TypeScript
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **React Router v6** - Navigation
- **Lucide React** - Icons

### Backend
- **Vercel Serverless Functions** - API endpoints
- **Oracle Cloud Autonomous Database** - OMOP vocabulary data
- **Supabase** - User authentication and data storage
- **oracledb** npm package - Oracle database connectivity

### Deployment
- **Vercel** - Hosting (frontend + backend together)

## Project Structure

```
mcsb_oracle/
├── src/                          # Frontend React application
│   ├── components/               # React components
│   │   ├── Step1Search.tsx       # Search interface
│   │   ├── Step2Hierarchy.tsx    # Hierarchy explorer
│   │   ├── Step3CodeSet.tsx      # Code set builder
│   │   ├── ShoppingCart.tsx      # Shopping cart component
│   │   └── Navigation.tsx        # Navigation/progress indicator
│   ├── lib/                      # Utilities
│   │   ├── api.ts                # API client
│   │   ├── supabase.ts           # Supabase client
│   │   └── types.ts              # TypeScript types
│   ├── App.tsx                   # Main app component
│   ├── main.tsx                  # Entry point
│   └── index.css                 # Global styles
│
├── api/                          # Vercel serverless functions
│   ├── search.ts                 # Step 1 query endpoint
│   ├── hierarchy.ts              # Step 2 query endpoint
│   └── codeset.ts                # Step 3 query endpoint
│
├── oracle_setup/                 # Database setup scripts
│   ├── 01_create_tables.sql      # Create OMOP tables
│   ├── 02_load_data.sql          # Data loading instructions
│   ├── 03_create_indexes.sql     # Performance indexes
│   ├── 04_test_queries.sql       # Validation tests
│   └── README.md                 # Database setup guide
│
├── SQL_Files/                    # Oracle SQL queries
│   ├── Step_1_Oracle.sql         # Search query
│   ├── Step_2_Oracle.sql         # Hierarchy query
│   └── Step_3_Oracle.sql         # Code set query
│
├── package.json                  # Frontend dependencies
├── vite.config.ts                # Vite configuration
├── tailwind.config.js            # Tailwind configuration
├── tsconfig.json                 # TypeScript configuration
├── vercel.json                   # Vercel deployment config
└── .env.example                  # Environment variables template

```

## Prerequisites

- **Node.js** 18+ and npm
- **Oracle Cloud Account** with Autonomous Database (Always Free tier)
- **Supabase Account** (free tier)
- **OMOP Vocabulary CSV files** (CONCEPT, CONCEPT_RELATIONSHIP, CONCEPT_ANCESTOR)

## Setup Instructions

### 1. Oracle Database Setup

Follow the guide in `oracle_setup/README.md`:

1. Create tables: `@oracle_setup/01_create_tables.sql`
2. Load CSV data (via SQL Developer or Object Storage)
3. Create indexes: `@oracle_setup/03_create_indexes.sql`
4. Test data: `@oracle_setup/04_test_queries.sql`

**See:** [oracle_setup/README.md](oracle_setup/README.md) for detailed instructions

### 2. Supabase Setup

1. Create a new Supabase project at https://supabase.com
2. Run this SQL in Supabase SQL Editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User preferences table
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_domain TEXT,
  theme TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Saved code sets table
CREATE TABLE saved_code_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  hierarchy_concept_ids BIGINT[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Search history table
CREATE TABLE search_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  search_term TEXT,
  domain TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_code_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own preferences"
  ON user_preferences FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own code sets"
  ON saved_code_sets FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own search history"
  ON search_history FOR ALL
  USING (auth.uid() = user_id);
```

3. Enable Email Authentication:
   - Go to Authentication → Providers
   - Enable Email provider
   - Configure email templates (optional)

4. Get your credentials:
   - Project URL: `https://your-project.supabase.co`
   - Anon/Public Key: Found in Settings → API

### 3. Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your credentials:
   ```env
   # Supabase
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key

   # Oracle Database (for API functions)
   ORACLE_USER=ADMIN
   ORACLE_PASSWORD=your-oracle-password
   ORACLE_CONNECTION_STRING=(description=(retry_count=20)(retry_delay=3)...)
   ORACLE_WALLET_LOCATION=/path/to/wallet
   ORACLE_WALLET_PASSWORD=your-wallet-password
   ```

### 4. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install API dependencies
cd api
npm install
cd ..
```

### 5. Run Development Server

```bash
npm run dev
```

The app will be available at http://localhost:5173

## Deployment to Vercel

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Deploy

```bash
vercel
```

### 3. Set Environment Variables in Vercel

Go to your Vercel project dashboard and add:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `ORACLE_USER`
- `ORACLE_PASSWORD`
- `ORACLE_CONNECTION_STRING`
- `ORACLE_WALLET_LOCATION` (upload wallet to Vercel)
- `ORACLE_WALLET_PASSWORD`

### 4. Deploy Again

```bash
vercel --prod
```

## User Workflow

### Step 1: Search & Select
- Enter search term (e.g., "ritonavir")
- Select domain (Condition, Drug, Procedure, etc.)
- View search results (up to 75 matches)
- Click row to select standard concept

### Step 2: Explore Hierarchy & Build Cart
- View concept hierarchy (parents and children)
- Click "Add to Cart" on any concept
- Shopping cart is always visible
- Navigate back to Step 1 to add more concepts
- Click "Build Code Set" when ready

### Step 3: Build Code Set
- System queries all concepts in cart
- Results combined into comprehensive code set
- Export options:
  - **TXT file** - Tab-delimited (vocabulary, code, name)
  - **SQL snippet** - Copy to clipboard for queries

## Features

✅ **Multi-concept shopping cart workflow**
✅ **Search across all OMOP vocabularies**
✅ **Explore hierarchical relationships**
✅ **Build comprehensive code sets**
✅ **Export as TXT or SQL**
✅ **User authentication (magic link)**
✅ **Save and reload code sets**
✅ **Search history**
✅ **Mobile responsive**

## Performance

- **Search queries:** < 2 seconds
- **Hierarchy queries:** < 1 second
- **Code set build:** 3-5 seconds (multiple concepts)
- **Index-optimized** for millions of rows

## Troubleshooting

### Oracle Connection Issues
- Verify wallet files are in correct location
- Check connection string format
- Ensure Autonomous Database is running

### API Timeout Errors
- Increase timeout in `vercel.json` (max 30s on free tier)
- Consider caching frequently accessed queries

### Supabase Authentication Not Working
- Check email provider is enabled
- Verify redirect URLs in Supabase settings
- Check browser console for errors

## License

MIT

## Deployment Status

Production deployment active on Vercel with authentication bypass enabled.

## Support

For issues, please check:
1. [Oracle Setup Guide](oracle_setup/README.md)
2. [Data Loading Instructions](oracle_setup/INSTRUCTIONS_data_load.md)
3. GitHub Issues (if applicable)
