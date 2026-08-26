# Athenaeum Quick Start Guide

Get Athenaeum up and running in under 5 minutes.

---

## Prerequisites

- [Node.js](https://nodejs.org) v18 or higher
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)
- A [Supabase account](https://supabase.com)
- A [Google AI Studio account](https://aistudio.google.com) (for Gemini API)

---

## Step 1: Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd athenaeum

# Install dependencies
npm install
```

---

## Step 2: Set Up Supabase Project

### Option A: Use Existing Project

If you already have a Supabase project:

```bash
# Link to your project
supabase link --project-ref your_project_ref
```

### Option B: Create New Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Fill in project details and wait for setup to complete
4. Copy your **Project Reference ID** from Settings > General

```bash
# Link to your new project
supabase link --project-ref your_new_project_ref
```

---

## Step 3: Run Database Migrations

```bash
# Push database schema to Supabase
supabase db push
```

This creates all necessary tables, RLS policies, and relationships.

---

## Step 4: Configure Frontend Environment

```bash
# Copy the environment template
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:

```env
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
VITE_SUPABASE_ANON_KEY="your_supabase_anon_key_here"
```

**Get these values from:**
- Supabase Dashboard > Your Project > **Settings** > **API**

**🔒 Security Note:**  
The `VITE_SUPABASE_ANON_KEY` is **designed to be public**. It's protected by Row Level Security (RLS) in your database, so users can only access their own data. This is standard Supabase architecture.

**⚠️ Do NOT put `GEMINI_API_KEY` in this file!** It will be configured server-side in Step 6.

---

## Step 5: Get Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with Google
3. Click **"Get API Key"** or **"Create API Key"**
4. Copy the key

---

## Step 6: Configure Edge Function Secrets

```bash
# Set API keys for edge functions (Gemini required; Mistral recommended as primary for generate-course)
supabase secrets set GEMINI_API_KEY=paste_your_gemini_key_here
supabase secrets set MISTRAL_API_KEY=paste_your_mistral_key_here  # optional but recommended — gets console.mistral.ai/api-keys → mistral-large-latest

# Verify they were set (shows key names but hides values)
supabase secrets list
```

> `generate-course` (`supabase/functions/generate-course/index.ts:489`) uses `MISTRAL_API_KEY` first if present, falls back to `GEMINI_API_KEY` (`gemini-3.6-flash`/`3.5-flash`). No `VITE_` key needed — `src/lib/api.ts:274` synthetic `Server` provider hits edge even without `VITE_MISTRAL_API_KEY`. `ingest-source` always uses `GEMINI_API_KEY`.

---

## Step 7: Deploy Edge Functions

```bash
# Deploy course generation + ingestion functions (redeploy after any secret change)
supabase functions deploy generate-course
supabase functions deploy ingest-source
supabase functions deploy generate-notes
```

---

## Step 8: Verify Setup

```bash
# Run the verification script
npm run verify-setup
```

You should see:
```
✅ VITE_SUPABASE_URL is set
✅ VITE_SUPABASE_ANON_KEY is set
✅ Supabase CLI installed
✅ Frontend environment setup looks good!
```

---

## Step 9: Start Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Step 10: Test Course Generation

1. **Sign up** for a new account
2. Click **"Generate New Course"**
3. Fill in the form:
   - **Topic**: "Introduction to Docker"
   - **Knowledge Level**: "Beginner"
   - **Goal**: "Deploy my first container"
   - **Time Commitment**: "30 minutes/day"
   - **Difficulty**: "Easy"
4. Click **"Generate Course"**
5. Wait 30-60 seconds for AI generation
6. Your course should appear in the dashboard!

---

## 🎉 You're Done!

Athenaeum is now fully set up and running.

### Next Steps

- **Customize**: Modify the AI prompt in `supabase/functions/generate-course/index.ts`
- **Style**: Adjust colors and themes in `src/index.css`
- **Extend**: Add new features or lesson types

---

## 🐛 Troubleshooting

### ❌ "AI service not configured" error

**Fix:**
```bash
supabase secrets set GEMINI_API_KEY=your_key
supabase functions deploy generate-course
```

### ❌ Can't sign up or log in

**Fix:**
1. Supabase Dashboard > **Authentication** > **Providers**
2. Ensure **Email** provider is enabled
3. Configure email templates if using custom domain

### ❌ "Failed to create course record"

**Fix:**
```bash
# Reset and re-run migrations
supabase db reset
supabase db push
```

### ❌ CORS errors in browser

**Fix:**
1. Check `VITE_SUPABASE_URL` matches your actual project URL
2. Clear browser cache
3. Restart dev server

### ❌ Environment variables not loading

**Fix:**
```bash
# Restart dev server after changing .env
# Press Ctrl+C to stop, then:
npm run dev
```

---

## 📚 Additional Resources

- **Detailed Setup**: [README.md](README.md)
- **Environment Variables**: [ENVIRONMENT.md](ENVIRONMENT.md)
- **Edge Functions**: [supabase/functions/README.md](supabase/functions/README.md)
- **Common Issues**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## 🆘 Need Help?

### Check Logs

```bash
# Frontend logs
# Open browser DevTools > Console

# Edge function logs
supabase functions serve generate-course --debug

# Database logs
# Supabase Dashboard > Database > Logs
```

### Run Diagnostics

```bash
# Verify frontend config
npm run verify-setup

# Check Supabase connection
supabase status

# List edge function secrets
supabase secrets list
```

### Get Support

- [Supabase Discord](https://discord.supabase.com)
- [Supabase GitHub Issues](https://github.com/supabase/supabase/issues)
- [Google AI Forum](https://discuss.ai.google.dev)

---

## 🚀 Deployment

Ready to deploy to production? See the [Deployment Guide](README.md#deployment) in the main README.

Quick summary:
1. Deploy to Vercel/Netlify (frontend)
2. Edge functions are already on Supabase
3. Set production environment variables
4. Enable email authentication
5. Configure custom domain (optional)

---

**Happy Learning! 📚✨**
