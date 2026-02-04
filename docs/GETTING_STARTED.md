# Getting Started with Medical Code Set Builder

Complete guide to running your application locally and deploying to production.

---

## Prerequisites Checklist

Before starting, ensure you have:

- [x] Node.js 18+ installed
- [x] Supabase project created and configured
- [x] Oracle Autonomous Database created
- [ ] Oracle data loaded (CONCEPT, CONCEPT_RELATIONSHIP, CONCEPT_ANCESTOR tables)
- [ ] Oracle Wallet downloaded
- [ ] Environment variables configured

---

## Step 1: Install Dependencies

Open terminal in project root (`C:\Users\T933261\mcsb_oracle\`) and run:

```bash
# Install frontend dependencies
npm install

# Install API dependencies
cd api
npm install
cd ..
```

**Expected time:** 2-3 minutes

---

## Step 2: Configure Environment Variables

1. **Create `.env` file** in project root:
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` file** with your actual credentials:

```env
# ==============================================================================
# Supabase Configuration (Frontend - VITE_ prefix required)
# ==============================================================================
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here

# ==============================================================================
# Oracle Database Configuration (Backend only - NO VITE_ prefix)
# ==============================================================================
ORACLE_USER=ADMIN
ORACLE_PASSWORD=YourOraclePassword123!
ORACLE_CONNECTION_STRING=(description=(retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1522)(host=your-db.adb.region.oraclecloud.com))(connect_data=(service_name=your_service_name))(security=(ssl_server_dn_match=yes)))

# Oracle Wallet Configuration
ORACLE_WALLET_LOCATION=C:\path\to\Wallet_YourDBName
ORACLE_WALLET_PASSWORD=YourWalletPassword123!

# ==============================================================================
# Application Settings
# ==============================================================================
NODE_ENV=development
```

### Where to Find Oracle Connection Details:

1. **Go to Oracle Cloud Console** → Autonomous Database → Your Database
2. Click **DB Connection**
3. Download **Wallet** (save to a folder like `C:\Oracle\Wallet_YourDBName`)
4. Copy **Connection String** from the connection details
5. **Wallet Password:** You set this when creating/downloading the wallet

---

## Step 3: Test Frontend (Without Oracle)

You can test the frontend UI before Oracle is fully configured:

```bash
npm run dev
```

- **Opens:** http://localhost:5173
- **What works:** Authentication, UI navigation, shopping cart
- **What doesn't work (yet):** Search queries (need Oracle connection)

**Expected:** You'll see the login page. Try signing in with your email!

---

## Step 4: Load Oracle Data

**If you haven't loaded your OMOP data yet:**

1. Follow the guide: [oracle_setup/INSTRUCTIONS_data_load.md](oracle_setup/INSTRUCTIONS_data_load.md)
2. Your CSV files should be uploaded to Oracle Object Storage
3. Run the `load_from_object_storage.sql` script
4. Run `03_create_indexes.sql`
5. Run `04_test_queries.sql` to verify

**Expected time:** 20-40 minutes depending on file sizes

---

## Step 5: Test Oracle Connection

Create a test script to verify your Oracle connection works:

**File:** `test-oracle-connection.js`

```javascript
const oracledb = require('oracledb');

async function testConnection() {
  let connection;
  try {
    // Set wallet location
    process.env.TNS_ADMIN = 'C:\\path\\to\\Wallet_YourDBName';

    connection = await oracledb.getConnection({
      user: 'ADMIN',
      password: 'YourOraclePassword123!',
      connectString: 'your_service_name_high',
    });

    console.log('✅ Successfully connected to Oracle!');

    const result = await connection.execute('SELECT COUNT(*) AS count FROM CONCEPT');
    console.log('✅ CONCEPT table row count:', result.rows[0]);

    return true;
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    return false;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

testConnection();
```

**Run it:**
```bash
node test-oracle-connection.js
```

**Expected output:**
```
✅ Successfully connected to Oracle!
✅ CONCEPT table row count: 7234567
```

---

## Step 6: Run Full Application Locally

Once Oracle data is loaded and connection is verified:

### Terminal 1: Start Frontend
```bash
npm run dev
```
- Runs on http://localhost:5173

### Terminal 2: Start API (For local API testing)

For Vercel serverless functions, you can use Vercel CLI:

```bash
# Install Vercel CLI (if not installed)
npm install -g vercel

# Run Vercel dev server
vercel dev
```

Or use the Vite proxy (frontend will proxy `/api/*` requests to port 3000).

---

## Step 7: Test the Complete Workflow

1. **Open browser:** http://localhost:5173

2. **Sign In:**
   - Enter your email
   - Click "Send Magic Link"
   - Check email and click the link

3. **Step 1: Search**
   - Search term: `ritonavir`
   - Domain: `Drug`
   - Click "Search"
   - **Expected:** 75 results from RxNorm/NDC
   - Click a row and "Select Concept"

4. **Step 2: Hierarchy**
   - **Expected:** Parents (ATC codes) and Children (Clinical Drugs)
   - Click "Add to Cart" on a few concepts
   - **Check:** Shopping cart shows added items

5. **Step 3: Build Code Set**
   - Click "Build Code Set" in cart
   - **Expected:** Comprehensive list of codes
   - Test "Export as TXT" and "Copy SQL"

---

## Troubleshooting

### Error: "Missing Oracle environment variables"
**Solution:** Check your `.env` file has `ORACLE_PASSWORD` and `ORACLE_CONNECTION_STRING` set.

### Error: "ORA-12154: TNS:could not resolve the connect identifier"
**Solution:**
- Verify `ORACLE_WALLET_LOCATION` points to correct wallet folder
- Check `ORACLE_CONNECTION_STRING` format
- Ensure wallet files (cwallet.sso, ewallet.p12, tnsnames.ora) are present

### Error: "ORA-01017: invalid username/password"
**Solution:** Double-check `ORACLE_USER` and `ORACLE_PASSWORD` in `.env`.

### Frontend loads but API calls fail
**Solution:**
- Check browser console for errors
- Verify API endpoints are running (Vercel dev or proxy)
- Check CORS headers in API responses

### "Table or view does not exist" errors
**Solution:** You haven't loaded the OMOP data yet. Go back to Step 4.

### Search returns 0 results
**Solution:**
- Verify data is loaded: Run `SELECT COUNT(*) FROM CONCEPT;` in Oracle
- Check indexes are created: Run `03_create_indexes.sql`
- Try a different search term (e.g., `diabetes`, `aspirin`)

---

## Deployment to Vercel

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Deploy
```bash
vercel
```

Follow the prompts:
- **Set up and deploy:** Yes
- **Which scope:** Your account
- **Link to existing project:** No
- **Project name:** mcsb-oracle
- **Directory:** `./`
- **Override settings:** No

### 4. Set Environment Variables in Vercel

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add these variables for **Production, Preview, and Development**:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
ORACLE_USER=ADMIN
ORACLE_PASSWORD=YourOraclePassword123!
ORACLE_CONNECTION_STRING=(description=...)
ORACLE_WALLET_LOCATION=/var/task/wallet
ORACLE_WALLET_PASSWORD=YourWalletPassword123!
```

**Important:** For Vercel, you'll need to include the wallet files in your deployment. See [Vercel Oracle deployment guide](https://vercel.com/guides/deploying-oracle-with-vercel).

### 5. Deploy to Production
```bash
vercel --prod
```

Your app will be live at: `https://mcsb-oracle.vercel.app`

---

## Project Structure Quick Reference

```
mcsb_oracle/
├── src/                    # Frontend React app
│   ├── components/         # React components
│   ├── lib/               # Utilities (API, Supabase, types)
│   ├── App.tsx            # Main app
│   └── main.tsx           # Entry point
│
├── api/                   # Backend serverless functions
│   ├── lib/oracle.ts      # Oracle connection utility
│   ├── search.ts          # Step 1 endpoint
│   ├── hierarchy.ts       # Step 2 endpoint
│   └── codeset.ts         # Step 3 endpoint
│
├── oracle_setup/          # Database setup scripts
├── SQL_Files/             # Oracle SQL queries
├── .env                   # Environment variables (local)
└── vercel.json            # Vercel configuration
```

---

## Next Steps After Setup

Once everything is working:

1. **Customize the UI** - Adjust colors, branding in `tailwind.config.js`
2. **Add more features:**
   - Save/load code sets (already in Supabase schema)
   - Search history
   - User preferences
3. **Optimize performance:**
   - Add caching for frequent queries
   - Implement pagination for large result sets
4. **Monitor usage:**
   - Set up Vercel Analytics
   - Monitor Oracle query performance

---

## Support & Resources

- **Oracle Setup:** See [oracle_setup/README.md](oracle_setup/README.md)
- **Supabase Setup:** See [SUPABASE_SETUP_GUIDE.md](SUPABASE_SETUP_GUIDE.md)
- **Project README:** See [README.md](README.md)
- **Oracle Docs:** https://docs.oracle.com/en/cloud/paas/autonomous-database/
- **Supabase Docs:** https://supabase.com/docs
- **Vercel Docs:** https://vercel.com/docs

---

## Success Checklist

Before considering setup complete:

- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file configured with all credentials
- [ ] Supabase tables created and RLS enabled
- [ ] Oracle data loaded (CONCEPT, CONCEPT_RELATIONSHIP, CONCEPT_ANCESTOR)
- [ ] Oracle indexes created
- [ ] Oracle connection test passes
- [ ] Frontend runs locally (`npm run dev`)
- [ ] Can sign in with magic link
- [ ] Search query returns results
- [ ] Hierarchy query works
- [ ] Code set build completes
- [ ] Export functions work (TXT and SQL)
- [ ] Deployed to Vercel (optional)

**If all checked, congratulations! Your app is fully functional!** 🎉
