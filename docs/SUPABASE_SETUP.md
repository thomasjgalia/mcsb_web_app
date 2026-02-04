# Supabase Authentication Setup Guide

This guide walks you through configuring Supabase authentication for the Medical Code Set Builder application with domain-based approval workflow.

## Overview

The application supports:
- **Email + Password** authentication
- **Magic Link** (passwordless) authentication
- **Auto-approval** for `@veradigm.me` email addresses
- **Manual approval** for external email addresses

---

## Step 1: Enable Email Confirmation

### 1.1 Navigate to Authentication Settings
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `idnazqdzdnbnoptmqujb`
3. Click **Authentication** in the left sidebar
4. Click **Settings**

### 1.2 Configure Email Auth
1. Scroll to **"Email Auth"** section
2. **Enable email confirmations**: Toggle ON
   - This ensures users must confirm their email before accessing the app
3. **Secure email change**: Toggle ON (recommended)
4. Click **Save**

---

## Step 2: Auto-Approve @veradigm.me Emails

You need to create a database trigger that automatically confirms `@veradigm.me` email addresses.

### 2.1 Open SQL Editor
1. In your Supabase Dashboard, click **SQL Editor** in the left sidebar
2. Click **New Query**

### 2.2 Create Auto-Approval Function
Copy and paste this SQL code:

```sql
-- Function to auto-confirm Veradigm emails
CREATE OR REPLACE FUNCTION auto_confirm_veradigm_emails()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if email ends with @veradigm.me
  IF NEW.email LIKE '%@veradigm.me' THEN
    -- Auto-confirm the email
    NEW.email_confirmed_at = NOW();
    NEW.confirmed_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger that runs before user insert
DROP TRIGGER IF EXISTS auto_confirm_veradigm_trigger ON auth.users;
CREATE TRIGGER auto_confirm_veradigm_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_confirm_veradigm_emails();

-- Also handle updates (in case email is changed)
DROP TRIGGER IF EXISTS auto_confirm_veradigm_update_trigger ON auth.users;
CREATE TRIGGER auto_confirm_veradigm_update_trigger
  BEFORE UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION auto_confirm_veradigm_emails();
```

### 2.3 Run the Query
1. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)
2. You should see "Success. No rows returned"

---

## Step 3: Customize Email Templates

### 3.1 Configure Confirmation Email
1. Go to **Authentication** → **Email Templates**
2. Select **"Confirm signup"** from the dropdown
3. Customize the email template (optional):

```html
<h2>Confirm Your Email</h2>
<p>Thanks for signing up for Medical Code Set Builder!</p>
<p>Click the link below to confirm your email address:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
<p>If you didn't create an account, you can safely ignore this email.</p>
```

4. Click **Save**

### 3.2 Configure Magic Link Email
1. Select **"Magic Link"** from the dropdown
2. Customize the template (optional):

```html
<h2>Sign In to Medical Code Set Builder</h2>
<p>Click the link below to sign in:</p>
<p><a href="{{ .Token }}">Sign In</a></p>
<p>This link will expire in 1 hour.</p>
<p>If you didn't request this, you can safely ignore this email.</p>
```

3. Click **Save**

---

## Step 4: Set Up Email Provider (Optional but Recommended)

By default, Supabase uses their email service, but it's rate-limited. For production, configure a custom SMTP provider.

### 4.1 Recommended: Use Gmail SMTP (for testing)
1. Go to **Project Settings** → **Auth** → **SMTP Settings**
2. Enable **"Use Custom SMTP Server"**
3. Configure:
   - **Host**: `smtp.gmail.com`
   - **Port**: `587`
   - **Username**: Your Gmail address
   - **Password**: [App Password](https://support.google.com/accounts/answer/185833) (not your regular password)
   - **Sender email**: Your Gmail address
   - **Sender name**: `Medical Code Set Builder`
4. Click **Save**

### 4.2 For Production: Use SendGrid, AWS SES, or similar
Configure your production email provider following Supabase's SMTP setup guide.

---

## Step 5: Configure Site URL and Redirect URLs

### 5.1 Set Site URL
1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL**:
   - **Development**: `http://localhost:5173`
   - **Production**: Your deployed URL (e.g., `https://mcsb-oracle.vercel.app`)
3. Click **Save**

### 5.2 Add Redirect URLs
Add these URLs to the **Redirect URLs** list:
- `http://localhost:5173/**` (for development)
- `https://your-production-url.vercel.app/**` (for production)

Click **Save**

---

## Step 6: Configure User Notifications (Optional)

To get notified when non-Veradigm users sign up:

### 6.1 Create Webhook for New User Signups
1. Go to **Database** → **Webhooks**
2. Click **Create a new hook**
3. Configure:
   - **Name**: `new-user-notification`
   - **Table**: `auth.users`
   - **Events**: `INSERT`
   - **Type**: `HTTP Request`
   - **URL**: Your notification endpoint (or email service like Zapier)
4. Click **Save**

### 6.2 Alternative: Email Notifications via Database Function
Run this SQL in the SQL Editor:

```sql
-- Function to send admin notification for non-Veradigm signups
CREATE OR REPLACE FUNCTION notify_admin_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify for non-Veradigm emails
  IF NEW.email NOT LIKE '%@veradigm.me' THEN
    -- Insert into a notifications table (you'll need to create this)
    -- Or integrate with your email service
    RAISE NOTICE 'New external user signup: %', NEW.email;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notify_admin_trigger ON auth.users;
CREATE TRIGGER notify_admin_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_new_user();
```

---

## Step 7: Manual User Approval Process

### 7.1 View Pending Users
To see users awaiting approval:

```sql
SELECT
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email_confirmed_at IS NULL
  AND email NOT LIKE '%@veradigm.me'
ORDER BY created_at DESC;
```

### 7.2 Manually Approve a User
To approve an external user:

```sql
UPDATE auth.users
SET
  email_confirmed_at = NOW(),
  confirmed_at = NOW()
WHERE email = 'user@external-domain.com';
```

### 7.3 Delete/Reject a User
To reject a signup:

```sql
DELETE FROM auth.users
WHERE email = 'user@external-domain.com';
```

---

## Step 8: Test the Authentication Flow

### 8.1 Test Auto-Approval (Veradigm Email)
1. Start your dev server: `npm run dev`
2. Go to http://localhost:5173
3. Click **Sign Up**
4. Enter a `@veradigm.me` email address
5. Enter a password (min 6 characters)
6. Click **Create Account**
7. ✅ You should be immediately signed in (no email confirmation needed)

### 8.2 Test Manual Approval (External Email)
1. Click **Sign Up**
2. Enter a non-Veradigm email (e.g., `test@gmail.com`)
3. Enter a password
4. Click **Create Account**
5. You'll see a "Check Your Email" screen
6. Go to Supabase SQL Editor and run:
   ```sql
   SELECT email, email_confirmed_at FROM auth.users WHERE email = 'test@gmail.com';
   ```
7. You should see `email_confirmed_at` is `NULL`
8. The user will see "Approval Pending" screen
9. Approve manually using the SQL from Step 7.2
10. User can now sign in

### 8.3 Test Magic Link
1. Click **Sign in with Magic Link**
2. Enter your email
3. Click **Send Magic Link**
4. Check your email
5. Click the link
6. ✅ You should be signed in

---

## Step 9: Row Level Security (RLS) - For Future Azure SQL Integration

When you integrate Azure SQL tables for user data, you can reference the Supabase user ID:

```sql
-- In Azure SQL
CREATE TABLE user_profiles (
  supabase_user_id UNIQUEIDENTIFIER PRIMARY KEY,
  email VARCHAR(255),
  created_at DATETIME DEFAULT GETDATE(),
  preferences NVARCHAR(MAX)
);
```

The frontend will pass the Supabase JWT token in API requests:

```typescript
// In your API calls
const token = (await supabase.auth.getSession()).data.session?.access_token;

fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

Your backend API will verify the JWT and extract the user ID to query Azure SQL.

---

## Troubleshooting

### Users aren't getting confirmation emails
- Check **Authentication** → **Settings** → **SMTP Settings**
- Verify email templates are enabled
- Check spam folder
- Use custom SMTP provider (Gmail, SendGrid) instead of Supabase default

### @veradigm.me emails aren't auto-confirmed
- Verify the trigger was created (Step 2)
- Check the trigger is active:
  ```sql
  SELECT * FROM pg_trigger WHERE tgname LIKE '%veradigm%';
  ```
- Re-run the trigger creation SQL

### Users see "Email not confirmed" but they clicked the link
- The user might not be signed in
- Check if `email_confirmed_at` is set in the database
- Have them sign out and sign in again

### Magic links aren't working
- Verify **Site URL** and **Redirect URLs** are correctly configured
- Check that the URL in the email matches your app URL
- Ensure no browser extensions are blocking redirects

---

## Security Considerations

1. **Never disable email confirmation** in production
2. **Always use HTTPS** in production
3. **Rotate your Supabase keys** periodically
4. **Monitor the auth.users table** for suspicious signups
5. **Set up rate limiting** in Supabase to prevent abuse
6. **Use Row Level Security (RLS)** if storing data in Supabase tables

---

## Next Steps

Once authentication is working:

1. **Deploy to Vercel**: Update environment variables in Vercel dashboard
2. **Update Site URL**: Change to your production URL
3. **Configure Azure SQL Integration**: Link Supabase user IDs to Azure SQL tables
4. **Build Admin Panel**: Create UI for approving external users (instead of using SQL)
5. **Add Password Reset**: Implement "Forgot Password" flow

---

## Questions?

Contact your system administrator or refer to:
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
