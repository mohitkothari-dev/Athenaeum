# Security Guide

## Athenaeum Security Architecture

This document explains the security model and best practices for Athenaeum.

---

## Overview: Two-Layer Security Model

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                        │
│              (Public - Exposed in Browser)               │
│                                                          │
│  ✅ VITE_SUPABASE_URL         - Public project URL      │
│  ✅ VITE_SUPABASE_ANON_KEY    - Public anon key         │
│                                                          │
│  Protection: Row Level Security (RLS) in database       │
│  Users can only access their own data                   │
└─────────────────────────────────────────────────────────┘
                            │
                    Authenticated API Calls
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   BACKEND LAYER                          │
│           (Private - Server-Side Only)                   │
│                                                          │
│  🔒 SUPABASE_SERVICE_ROLE_KEY  - Admin database access  │
│  🔒 GEMINI_API_KEY             - AI API access          │
│                                                          │
│  Protection: Supabase Secrets Vault                     │
│  Never exposed to client, stored server-side            │
└─────────────────────────────────────────────────────────┘
```

---

## Frontend Security (VITE_ Variables)

### ✅ Safe to Expose

The following variables are **designed** to be public:

| Variable | Why It's Safe |
|----------|---------------|
| `VITE_SUPABASE_URL` | Just your project URL, needs to be known to connect |
| `VITE_SUPABASE_ANON_KEY` | Protected by RLS, rate-limited, standard Supabase pattern |

### How VITE_SUPABASE_ANON_KEY Protection Works

**1. Row Level Security (RLS)**
```sql
-- Example: Users can only read their own courses
CREATE POLICY "Users can view own courses"
ON courses FOR SELECT
USING (auth.uid() = user_id);

-- Users can only insert courses for themselves
CREATE POLICY "Users can create own courses"
ON courses FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

**2. Built-in Rate Limiting**
- Supabase automatically rate-limits anon key requests
- Prevents abuse even if someone copies your key
- Configurable in Supabase Dashboard > Authentication > Rate Limits

**3. Authentication Required**
- Most operations require a valid JWT token
- Users must log in to access their data
- Anon key alone can't access protected resources

**4. API Policies**
- Row Level Security enforces access control at the database level
- Even with the anon key, users can't bypass RLS
- This is the standard security model for ALL Supabase apps

### Real-World Analogy

Think of `VITE_SUPABASE_ANON_KEY` like:
- **Your gym's address**: Public, everyone knows it
- **Your membership card**: You still need this to get in
- **Your locker key**: Only you can access your locker

Even if someone knows the gym address, they can't access your locker without your membership and key.

---

## Backend Security (Edge Function Secrets)

### 🔒 Must Be Private

These variables **bypass security** and **cost money**:

| Variable | Risk if Exposed |
|----------|-----------------|
| `SUPABASE_SERVICE_ROLE_KEY` | **CRITICAL** - Bypasses ALL RLS, full admin access to database |
| `GEMINI_API_KEY` | **HIGH** - Uses your API quota, could rack up charges |

### How Backend Variables Are Protected

**1. Stored in Supabase Secrets Vault**
```bash
# Secure way to set secrets
supabase secrets set GEMINI_API_KEY=your_key_here

# Never stored in git
# Never in .env file
# Never sent to client
```

**2. Only Available Server-Side**
```typescript
// Edge functions (Deno runtime) can access
const key = Deno.env.get("GEMINI_API_KEY"); ✅

// Frontend CANNOT access (import.meta.env only sees VITE_ vars)
const key = import.meta.env.GEMINI_API_KEY; ❌ undefined
```

**3. Auto-Injected by Supabase**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` are automatically provided
- No manual configuration needed
- Managed by Supabase platform

---

## Security Checklist

### ✅ DO

- [x] Use `VITE_SUPABASE_ANON_KEY` in frontend (it's safe!)
- [x] Store `GEMINI_API_KEY` in Supabase secrets
- [x] Commit `.env.example` to git (it's just a template)
- [x] Add `.env` to `.gitignore` (already done)
- [x] Use RLS policies on all database tables
- [x] Validate user authentication in edge functions
- [x] Rate-limit API endpoints
- [x] Use HTTPS only (Supabase enforces this)

### ❌ DON'T

- [ ] Put `GEMINI_API_KEY` in `.env` file
- [ ] Put `SUPABASE_SERVICE_ROLE_KEY` in frontend
- [ ] Commit `.env` to git (it's in .gitignore)
- [ ] Use service role key in frontend code
- [ ] Disable RLS on tables (except for specific use cases)
- [ ] Expose sensitive API keys in `VITE_` variables
- [ ] Share service role key in documentation or issues

---

## Common Security Questions

### Q: "Isn't it dangerous to expose the anon key in my frontend bundle?"

**A:** No, this is **by design**. Every Supabase application works this way. The anon key is:
- Rate-limited by Supabase
- Protected by RLS policies
- Only provides read access to public data and authenticated access to user data
- Standard industry practice (similar to Firebase API keys)

**Reference:** [Supabase Security Best Practices](https://supabase.com/docs/guides/auth#security-considerations)

### Q: "What if someone steals my VITE_SUPABASE_ANON_KEY?"

**A:** They still can't access user data because:
1. RLS policies enforce `auth.uid() = user_id` checks
2. They'd need valid user credentials (email/password) to authenticate
3. Rate limiting prevents brute-force attacks
4. All sensitive operations are in edge functions with service role key

### Q: "Why was GEMINI_API_KEY removed from .env?"

**A:** It was a mistake to have it there. API keys that:
- Cost money to use
- Have quotas
- Provide external service access

Should **always** be server-side only (edge functions).

### Q: "How do I rotate my keys if they're compromised?"

**Frontend (Anon Key):**
```bash
# Generate new anon key in Supabase Dashboard
# Update in Supabase Dashboard > Settings > API > Generate new anon key
# Update your .env file
# Redeploy frontend
```

**Backend (Edge Function Secrets):**
```bash
# Update secret
supabase secrets set GEMINI_API_KEY=new_key_here

# Redeploy functions
supabase functions deploy generate-course
```

---

## RLS Policy Examples

### Courses Table
```sql
-- Users can only see their own courses
CREATE POLICY "Users can view own courses"
ON courses FOR SELECT
USING (auth.uid() = user_id);

-- Users can create courses for themselves only
CREATE POLICY "Users can create own courses"
ON courses FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own courses
CREATE POLICY "Users can update own courses"
ON courses FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own courses
CREATE POLICY "Users can delete own courses"
ON courses FOR DELETE
USING (auth.uid() = user_id);
```

### Lessons Table (Related to Courses)
```sql
-- Users can only see lessons from their courses
CREATE POLICY "Users can view lessons from own courses"
ON lessons FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM courses
    WHERE courses.id = lessons.course_id
    AND courses.user_id = auth.uid()
  )
);
```

---

## Security Audit Checklist

Run this checklist periodically:

### Code Review
- [ ] No API keys in frontend code
- [ ] No service role key usage in frontend
- [ ] All edge functions validate authentication
- [ ] Sensitive operations use service role key

### Configuration Review
- [ ] `.env` file not committed to git
- [ ] All secrets in Supabase secrets vault
- [ ] Only `VITE_` prefixed vars in `.env`
- [ ] `supabase/functions/.env` in `.gitignore`

### Database Review
- [ ] RLS enabled on all tables
- [ ] RLS policies test with `auth.uid()`
- [ ] No public tables with sensitive data
- [ ] Foreign key constraints in place

### API Review
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Authentication required for mutations
- [ ] Input validation in edge functions

---

## Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** open a public GitHub issue
2. **DO NOT** share details in public forums
3. **DO** email the maintainers directly
4. **DO** include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

---

## Security Resources

### Supabase Security
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth#security-considerations)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Edge Functions Security](https://supabase.com/docs/guides/functions/security)

### General Web Security
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Mozilla Web Security Guidelines](https://infosec.mozilla.org/guidelines/web_security)
- [Deno Security Best Practices](https://deno.land/manual/basics/permissions)

---

## Summary

✅ **Frontend Security**: Anon key is safe, protected by RLS  
🔒 **Backend Security**: Service role key and API keys are private  
📊 **Database Security**: RLS policies enforce access control  
🔐 **Secrets Management**: Use Supabase secrets vault  
🚀 **Standard Practice**: This follows Supabase's recommended architecture  

**Key Takeaway**: The security model is already correct. The anon key being public is intentional and safe!
