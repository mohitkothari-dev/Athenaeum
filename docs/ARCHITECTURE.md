# Athenaeum Architecture & Environment Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │            React Frontend (Vite)                       │    │
│  │                                                         │    │
│  │  Environment:                                          │    │
│  │  • VITE_SUPABASE_URL ────────────────┐                │    │
│  │  • VITE_SUPABASE_ANON_KEY ───────────┤                │    │
│  │  • VITE_GEMINI_API_KEY (optional)    │                │    │
│  │                                       │                │    │
│  │  Source: .env (PUBLIC - in bundle!) ▼                 │    │
│  └────────────────────────────┬───────────────────────────┘    │
└───────────────────────────────┼───────────────────────────────┘
                                │
                    HTTP POST with JWT Token
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SUPABASE PLATFORM                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │               Supabase Auth                              │  │
│  │  • Validates JWT token                                   │  │
│  │  • Returns user identity                                 │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                         │                                        │
│  ┌──────────────────────▼───────────────────────────────────┐  │
│  │          Edge Function: generate-course                  │  │
│  │          (Deno Runtime)                                  │  │
│  │                                                           │  │
│  │  Auto-Injected Environment (by Supabase):               │  │
│  │  • SUPABASE_URL                                          │  │
│  │  • SUPABASE_SERVICE_ROLE_KEY ──────┐                    │  │
│  │  • SUPABASE_ANON_KEY               │                    │  │
│  │                                     │                    │  │
│  │  Manual Secrets (via CLI):         │                    │  │
│  │  • GEMINI_API_KEY ─────────────────┼─────────┐          │  │
│  │                                     │         │          │  │
│  │  Source: Supabase Secrets          │         │          │  │
│  │  (PRIVATE - server-side only!)     │         │          │  │
│  └─────────────────────────────────────┼─────────┼──────────┘  │
│                                        │         │              │
│  ┌─────────────────────────────────────▼─────────┼──────────┐  │
│  │           PostgreSQL Database                 │          │  │
│  │  • courses, modules, lessons tables           │          │  │
│  │  • Row Level Security (RLS)                   │          │  │
│  │  • Uses SERVICE_ROLE_KEY for admin ops       │          │  │
│  └───────────────────────────────────────────────┘          │  │
│                                                               │  │
└───────────────────────────────────────────────────────────────┘
                                │
                    External API Call
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Google Gemini API                             │
│                                                                  │
│  Request with GEMINI_API_KEY ◄──────────────────────────────────┤
│  Returns: JSON course structure                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Environment Variable Flow

### Frontend (.env file)

```
Developer's .env file
       │
       ├─► VITE_SUPABASE_URL ────────┐
       ├─► VITE_SUPABASE_ANON_KEY ────┤
       └─► VITE_GEMINI_API_KEY ───────┤
                                       │
                        Vite Build Process
                                       │
                         Bundled into JS/HTML
                                       │
                         ⚠️  PUBLIC in Browser
                                       │
                    Used by @supabase/supabase-js
                                       │
              Creates authenticated HTTP requests
```

### Edge Function (Supabase Secrets)

```
Supabase Platform Auto-Injection
       │
       ├─► SUPABASE_URL
       ├─► SUPABASE_SERVICE_ROLE_KEY
       └─► SUPABASE_ANON_KEY
       
Developer via Supabase CLI
       │
       └─► GEMINI_API_KEY
              │
      supabase secrets set
              │
    Stored in Supabase Vault
              │
    Injected into Deno Runtime
              │
      Deno.env.get("GEMINI_API_KEY")
              │
      🔒 PRIVATE - Server-side only
```

## Request Flow: Course Generation

```
1. User clicks "Generate Course" in browser
         │
         ▼
2. React app sends POST to /functions/v1/generate-course
   Headers:
   • Authorization: Bearer <JWT_TOKEN>
   • Content-Type: application/json
   Body: { topic, knowledge_level, goal, ... }
         │
         ▼
3. Supabase routes request to edge function
   Injects environment variables
         │
         ▼
4. Edge function validates JWT
   const { data: userData } = await supabase.auth.getUser(jwt)
         │
         ├─► Valid? → Continue
         └─► Invalid? → Return 401
         │
         ▼
5. Create initial course record in database
   Uses SUPABASE_SERVICE_ROLE_KEY for admin access
         │
         ▼
6. Call Gemini API with GEMINI_API_KEY
   POST to generativelanguage.googleapis.com
         │
         ▼
7. Parse AI response (JSON course structure)
         │
         ▼
8. Insert modules and lessons into database
         │
         ▼
9. Return course ID to frontend
         │
         ▼
10. Frontend displays generated course
```

## Security Boundaries

### Public (Frontend)

```
✅ Safe to expose:
• VITE_SUPABASE_URL
• VITE_SUPABASE_ANON_KEY (rate-limited, RLS protected)
• VITE_GEMINI_API_KEY (if needed for client-side features)

⚠️  These are visible in:
• Browser DevTools
• Network requests
• Built JavaScript bundle
• View source
```

### Private (Edge Functions)

```
🔒 Must be kept secret:
• SUPABASE_SERVICE_ROLE_KEY (bypasses RLS!)
• GEMINI_API_KEY (your quota/billing)

✅ Protected by:
• Server-side execution only
• Supabase secrets vault
• Never sent to client
• Not in git repository
```

## Configuration Checklist

### Frontend Setup
- [ ] Create `.env` file from `.env.example`
- [ ] Add `VITE_SUPABASE_URL`
- [ ] Add `VITE_SUPABASE_ANON_KEY`
- [ ] Run `npm run verify-setup`
- [ ] Start dev server: `npm run dev`

### Edge Function Setup
- [ ] Install Supabase CLI
- [ ] Run `supabase login`
- [ ] Run `supabase link --project-ref YOUR_REF`
- [ ] Run `supabase secrets set GEMINI_API_KEY=YOUR_KEY`
- [ ] Run `supabase secrets list` to verify
- [ ] Deploy: `supabase functions deploy generate-course`

### Database Setup
- [ ] Run migrations: `supabase db push`
- [ ] Verify tables exist in Supabase Dashboard
- [ ] Check RLS policies are enabled

## Common Pitfalls

### ❌ Mixing Frontend and Backend Config

```typescript
// WRONG - Edge function trying to use VITE_ variables
const url = Deno.env.get("VITE_SUPABASE_URL"); // undefined!

// CORRECT - Edge functions use non-prefixed variables
const url = Deno.env.get("SUPABASE_URL"); // auto-injected ✓
```

### ❌ Exposing Secrets in Frontend

```typescript
// WRONG - Service role key in frontend
const supabase = createClient(url, "service_role_key_here"); // NEVER!

// CORRECT - Use anon key in frontend
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

### ❌ Forgetting to Redeploy After Secrets Change

```bash
# WRONG - Secrets changed but function not redeployed
supabase secrets set GEMINI_API_KEY=new_key
# Old function still running with old key!

# CORRECT - Always redeploy
supabase secrets set GEMINI_API_KEY=new_key
supabase functions deploy generate-course
```

## File Structure

```
athenaeum/
├── .env                          # Frontend environment (gitignored)
├── .env.example                  # Template with docs
│
├── supabase/
│   ├── functions/
│   │   ├── .env                 # Local dev only (gitignored)
│   │   ├── README.md            # Edge function setup guide
│   │   └── generate-course/
│   │       └── index.ts         # Uses Deno.env.get()
│   │
│   └── migrations/              # Database schema
│       └── *.sql
│
├── src/
│   ├── lib/
│   │   └── supabase.ts         # Uses import.meta.env.VITE_*
│   └── ...
│
├── scripts/
│   └── verify-setup.js         # Config verification tool
│
├── ENVIRONMENT.md              # Variable reference
├── QUICKSTART.md              # Setup guide
└── TROUBLESHOOTING.md         # Common issues
```

## Related Documentation

- [Quick Start Guide](../QUICKSTART.md) - Step-by-step setup
- [Environment Variables Reference](../ENVIRONMENT.md) - Complete variable list
- [Edge Functions Setup](../supabase/functions/README.md) - Detailed function config
- [Troubleshooting](../TROUBLESHOOTING.md) - Common issues

---

**Key Principle**: Frontend and Edge Functions have separate, isolated environments. Frontend variables are public; edge function variables are private.
