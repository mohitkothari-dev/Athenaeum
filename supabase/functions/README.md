# Supabase Edge Functions Setup Guide

## Overview

This directory contains Supabase Edge Functions that run on Deno Deploy runtime. These functions require their own environment configuration separate from the frontend `.env` file.

## Required Environment Variables

Edge Functions access environment variables through `Deno.env.get()`. The following secrets must be configured:

### Auto-Injected by Supabase
These are automatically available in your edge functions:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Public anonymous key for client operations
- `SUPABASE_SERVICE_ROLE_KEY` - Admin key with full database access (use carefully!)

### Manual Configuration Required
- `GEMINI_API_KEY` - Google Gemini API key — **required** (fallback for `generate-course`, required for `ingest-source` YouTube/PDF `callGeminiMultimodal` `gemini-3.6-flash`/`3.5-flash`)
- `MISTRAL_API_KEY` - Mistral API key — **recommended** (primary for `generate-course` `mistral-large-latest`; edge tries `Mistral` first if set, falls back to `Gemini`)

## Setup Instructions

### 1. Login to Supabase CLI
```bash
supabase login
```

### 2. Link Your Project
```bash
supabase link --project-ref your_project_ref
```

To find your project ref:
- Go to your Supabase Dashboard
- Navigate to Settings > General
- Copy the "Reference ID"

### 3. Set Required Secrets
```bash
supabase secrets set GEMINI_API_KEY=your_actual_gemini_api_key
supabase secrets set MISTRAL_API_KEY=your_actual_mistral_api_key  # optional but recommended — makes Mistral primary
```

### 4. Verify Secrets (Optional)
```bash
supabase secrets list
```

### 5. Deploy Functions
```bash
# Deploy all functions
supabase functions deploy

# Or deploy a specific function
supabase functions deploy generate-course
```

## Local Development

For local testing with Supabase CLI:

1. Create a `.env` file in `supabase/functions/`:
    ```env
    GEMINI_API_KEY=your_gemini_api_key_here
    MISTRAL_API_KEY=your_mistral_api_key_here  # optional
    ```

2. Serve functions locally:
   ```bash
   supabase functions serve generate-course --env-file supabase/functions/.env
   ```

3. Test the function:
   ```bash
   curl -i --location --request POST 'http://localhost:54321/functions/v1/generate-course' \
     --header 'Authorization: Bearer YOUR_ANON_KEY' \
     --header 'Content-Type: application/json' \
     --data '{"topic":"Docker","knowledge_level":"Beginner","goal":"Deploy apps","time_commitment":"30min/day","difficulty":"Easy"}'
   ```

## Security Notes

⚠️ **Important Security Considerations:**

1. **Service Role Key**: The `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security (RLS). Only use it when necessary and always validate user authentication first.

2. **Never Commit Secrets**: 
   - The `supabase/functions/.env` file should be in `.gitignore`
   - Use Supabase secrets management for production
   - Frontend `.env` variables (prefixed with `VITE_`) are public and bundled into your app

3. **API Keys**: Keep your `GEMINI_API_KEY` secure. Set rate limits and quotas in the Google AI Studio dashboard.

## Troubleshooting

### "AI service not configured" Error
- Verify `GEMINI_API_KEY` is set: `supabase secrets list`
- Redeploy the function after setting secrets
- Check the Supabase Functions logs in your dashboard

### "Server configuration error"
- This means `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` are missing
- These should be auto-injected by Supabase - check your project is properly linked
- Verify in Dashboard > Settings > API that your keys exist

### Local Development Issues
- Ensure you have the latest Supabase CLI: `supabase --version`
- Use `--env-file` flag when serving functions locally
- Check Docker is running (required for local Supabase)

## Environment Variable Reference

| Variable | Source | Required | Purpose |
|----------|--------|----------|---------|
| `SUPABASE_URL` | Auto-injected | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected | ✅ | Admin database access |
| `SUPABASE_ANON_KEY` | Auto-injected | ❌ | Public client operations (not used in generate-course) |
| `GEMINI_API_KEY` | Manual setup | ✅ | Google Gemini AI API access — fallback for `generate-course`, required for `ingest-source` |
| `MISTRAL_API_KEY` | Manual setup | ⚪ | Mistral AI API access — primary for `generate-course` (`mistral-large-latest`; edge `Deno.env.get("MISTRAL_API_KEY")` checked first at `supabase/functions/generate-course/index.ts:489`) |

## Getting API Keys

### Gemini API Key
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and set it using `supabase secrets set GEMINI_API_KEY=...`

### Mistral API Key (recommended — primary)
1. Visit [Mistral Console](https://console.mistral.ai/api-keys)
2. Sign in → **API Keys** → **Create new key**
3. Copy the key and set it using `supabase secrets set MISTRAL_API_KEY=...`
4. Redeploy: `supabase functions deploy generate-course` (edge checks `Deno.env.get("MISTRAL_API_KEY")` first)

### Supabase Keys
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to Settings > API
4. Find your keys:
   - **anon/public key** - for frontend (goes in `.env` as `VITE_SUPABASE_ANON_KEY`)
   - **service_role key** - auto-injected into edge functions (never put in frontend!)
