# AGENTS.md

Vite + React 18 (TypeScript) frontend, Supabase backend (PostgreSQL + RLS), one Deno edge function (`generate-course`) that calls the Gemini API. No router library — views are switched by local state in `src/App.tsx`.

## Commands

```bash
npm run dev          # dev server (localhost:5173)
npm run build        # vite build
npm run lint         # eslint .
npm run typecheck    # tsc --noEmit -p tsconfig.app.json (app only)
npm test             # vitest --run (single run)
npm run test:watch   # vitest
npm run test:ui      # vitest --ui
npm run verify-setup # checks .env / Supabase CLI
```

Run `lint` and `typecheck` before finishing work. There is no CI or pre-commit hook.

## Env & Supabase

- `.env` (gitignored) requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; `src/lib/supabase.ts` throws at import if either is missing.
- **Never put `GEMINI_API_KEY` in `.env`** — `VITE_` vars are bundled into the public client. The key belongs in Supabase secrets (`supabase secrets set GEMINI_API_KEY=...`), read server-side only via `Deno.env.get("GEMINI_API_KEY")`.
- Edge functions run on **Deno, not Node**: no npm imports, no `import.meta.env` (use auto-injected `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY`). Redeploy after changing secrets: `supabase functions deploy generate-course`.
- Migrations live in `supabase/migrations/*.sql`; apply with `supabase db push`. All tables use RLS scoped to `auth.uid() = user_id`. The edge function uses the service role key (bypasses RLS) to write generated courses — it must validate the JWT first.

## Codebase notes

- Import alias: `@/` → `src/` (configured in both `vite.config.ts` and `tsconfig.app.json`).
- DB JSON columns (`quiz`, `flashcards`, `learning_objectives`, `key_takeaways`, canvas `type_specific_data`) are stored as strings/JSONB and serialized/deserialized manually in `src/lib/api.ts` (`parseLesson`, `serializeElementData`/`deserializeCanvasElement`). When adding fields to these payloads, keep the parse/serialize functions in sync.
- Canvas feature: types in `src/types/canvas.ts` (discriminated union `CanvasElement`), transform math in `src/lib/canvas.ts`, rendering in `src/lib/renderers.ts`, engine hook in `src/hooks/useCanvasEngine.ts`, persistence in `src/lib/api.ts`. The `type` field is the union discriminator.

## Tests

- Vitest + jsdom + Testing Library, globals enabled, setup in `src/test/setup.ts`, config in `vite.config.ts` `test` block.
- Tests are pure logic (canvas transforms, serialization, user isolation) — no Supabase instance required. Canvas tests use `fast-check` for property-based testing.
- Run a single test with: `npx vitest run <path>`.

## Docs

Detailed setup and architecture are in `QUICKSTART.md`, `ENVIRONMENT.md`, `docs/ARCHITECTURE.md`, and `supabase/functions/README.md`. Rely on them for setup/deploy; keep this file for agent-relevant gotchas only.
