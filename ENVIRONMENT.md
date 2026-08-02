# Environment Variables Reference

Quick reference for all environment variables used in Athenaeum.

## Overview

Athenaeum uses **two separate environments** for configuration:

1. **Frontend Environment** (`.env` file) - Variables prefixed with `VITE_` for the React app
2. **Edge Function Environment** (Supabase Secrets) - Server-side variables for Deno runtime

---

## Frontend Variables (.env file)

These variables are used by Vite and embedded into your frontend bundle. They are **publicly accessible** in the browser.

| Variable | Required | Purpose | Example | Security Level |
|----------|----------|---------|---------|----------------|
| `VITE_SUPABASE_URL` | ✅ Yes | Your Supabase project URL | `https://abc123.supabase.co` | ✅ **Safe to expose** |
| `VITE_SUPABASE_ANON_KEY` | ✅ Yes | Public/anonymous Supabase key | `ancdefgh...` | ✅ **Safe to expose** (RLS protected) |

### Why is VITE_SUPABASE_ANON_KEY safe to expose?

🔒 **This is Supabase's security model by design:**

1. **Row Level Security (RLS)**: Your database has RLS policies that restrict data access based on authentication
2. **Rate Limiting**: The anon key has built-in rate limiting to prevent abuse
3. **Policy Enforcement**: Users can only access their own data, regardless of having the anon key
4. **Standard Practice**: Every Supabase app exposes this key in the frontend—it's designed for this

**Example RLS Policy:**
```sql
-- Users can only read their own courses
CREATE POLICY "Users can view own courses"
ON courses FOR SELECT
USING (auth.uid() = user_id);
```

### Setup Frontend Environment

```bash
# Copy the template
cp .env.example .env

# Edit .env and fill in your values
# Get keys from: https://supabase.com/dashboard > Your Project > Settings > API
```

### ⚠️ Security Warning

**NEVER put sensitive API keys in .env:**
- ❌ Don't put `VITE_GEMINI_API_KEY` - it would be exposed in your bundle
- ❌ Don't put `VITE_OPENAI_API_KEY` - it would be exposed in your bundle  
- ❌ Don't put any payment API keys (Stripe secret, etc.)
- ❌ Don't put the `service_role` key - it bypasses all security!

**Rule of thumb:** If revealing the key could cost you money or expose data, it belongs in edge functions, not the frontend.

---

## Edge Function Variables (Supabase Secrets)

These variables run on Supabase's Deno edge runtime. They are **server-side only** and never exposed to the browser.

### Auto-Injected by Supabase

These are automatically available in all edge functions. **No setup required.**

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Your Supabase project URL (auto-injected) |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key with full database access (bypasses RLS) |
| `SUPABASE_ANON_KEY` | Public/anonymous key |

### Manual Configuration Required

| Variable | Required | Purpose | Setup Command |
|----------|----------|---------|---------------|
| `GEMINI_API_KEY` | ✅ Yes | Google Gemini API for course generation | `supabase secrets set GEMINI_API_KEY=your_key` |

### Setup Edge Function Secrets

```bash
# 1. Login to Supabase CLI
supabase login

# 2. Link your project (find ref in Dashboard > Settings > General)
supabase link --project-ref your_project_ref

# 3. Set the Gemini API key
supabase secrets set GEMINI_API_KEY=your_actual_gemini_api_key

# 4. Verify secrets were set
supabase secrets list

# 5. Deploy edge functions
supabase functions deploy generate-course
```

### Local Development

For local edge function testing, create `supabase/functions/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Then serve locally:
```bash
supabase functions serve generate-course --env-file supabase/functions/.env
```

---

## Quick Start Checklist

- [ ] Copy `.env.example` to `.env`
- [ ] Add `VITE_SUPABASE_URL` to `.env`
- [ ] Add `VITE_SUPABASE_ANON_KEY` to `.env` (this is safe to expose!)
- [ ] Run `npm run verify-setup` to check frontend config
- [ ] Run `supabase login`
- [ ] Run `supabase link --project-ref YOUR_REF`
- [ ] Run `supabase secrets set GEMINI_API_KEY=YOUR_KEY` (server-side only!)
- [ ] Run `supabase secrets list` to verify
- [ ] Run `supabase functions deploy generate-course`
- [ ] Start dev server with `npm run dev`

**Security Note:** Never put `GEMINI_API_KEY` or other sensitive API keys in your `.env` file!

---

## Getting API Keys

### Supabase Keys

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings** > **API**
4. Copy the keys:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`
   - **service_role key** → Auto-injected into edge functions (don't add manually!)

### Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Get API Key"** or **"Create API Key"**
4. Copy the key
5. Set via Supabase CLI: `supabase secrets set GEMINI_API_KEY=your_key`

---

## Common Mistakes

### ❌ Using `VITE_` prefix in edge functions
```typescript
// WRONG - This won't work in edge functions
const key = Deno.env.get("VITE_GEMINI_API_KEY");

// CORRECT
const key = Deno.env.get("GEMINI_API_KEY");
```

### ❌ Adding secrets to `.env` file
```bash
# WRONG - .env is for frontend only
SUPABASE_SERVICE_ROLE_KEY=secret_key_here

# CORRECT - Use Supabase secrets
supabase secrets set GEMINI_API_KEY=your_key
```

### ❌ Forgetting to redeploy after setting secrets
```bash
# Always redeploy after changing secrets
supabase secrets set GEMINI_API_KEY=new_key
supabase functions deploy generate-course  # Don't forget this!
```

### ❌ Using service role key in frontend
```typescript
// WRONG - NEVER expose service role key in frontend
const SUPABASE_SERVICE_KEY = "your_service_role_key";

// CORRECT - Service role key is only for edge functions
// Frontend should only use VITE_SUPABASE_ANON_KEY
```

---

## Verification

### Check Frontend Setup
```bash
npm run verify-setup
```

### Check Edge Function Setup
```bash
# View configured secrets (values are hidden for security)
supabase secrets list

# Test locally
supabase functions serve generate-course --env-file supabase/functions/.env

# View logs
supabase functions serve generate-course --debug
```

---

## Need Help?

- Frontend setup issues → Run `npm run verify-setup`
- Edge function issues → See [`supabase/functions/README.md`](supabase/functions/README.md)
- General problems → See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
