# Phase 2: Supabase environment configuration

Status: Completed  
Date: 2026-07-31

## Scope completed

Phase 2 adds safe, public Supabase browser configuration without activating cloud behavior:

- standardized `.env.example` on `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`;
- ignored local environment files while retaining the committed example;
- confirmed no local `.env` was tracked;
- added typed Vite environment declarations;
- added a Supabase browser client with persistent-session, token-refresh, and callback-detection options;
- retained temporary support for `VITE_SUPABASE_ANON_KEY`;
- kept the client nullable so missing configuration never blocks local operation;
- added a safe missing-configuration message;
- added focused configuration tests;
- documented local setup, public-key security, and current GitHub Pages limitations.

## Compatibility behavior

Dexie v4, local authentication, user sessions, and all existing pages are unchanged. No environment file is read directly and no IndexedDB data is migrated or modified.

The source prefers the new publishable variable. Existing developers who already have only `VITE_SUPABASE_ANON_KEY` continue to work until the compatibility fallback is removed in a later phase.

## Security boundary

The Supabase project URL and publishable key are public frontend values. Protection must eventually come from Supabase Auth, Row Level Security, membership validation, and secure server-side functions.

Phase 2 does not introduce or accept privileged frontend credentials. The application never logs configured values.

## Final verification

| Check | Result |
|---|---|
| Forced TypeScript project build | Passed |
| Vitest regression suite | Passed: 12 files, 37 tests |
| Production build without Supabase variables | Passed |
| Production build with public placeholder variables | Passed |
| Built-app smoke test | Passed: HTTP 200 at `/tindahan-manager/` |
| Environment ignore verification | Passed; plain `.env` is ignored and untracked |
| Privileged-value assignment scan | Passed: zero matches |
| Diff whitespace check | Passed |
| ESLint | Could not analyze source because the existing ESLint 9 flat configuration is missing |

Both builds generated the PWA assets. The main JavaScript bundle is approximately 1.27 MB minified after including the Supabase browser dependency and retains Vite's chunk-size warning.

## Not implemented

- Supabase authentication or account linking
- cloud database tables or SQL migrations
- Row Level Security policies
- GitHub Actions secret injection
- remote reads or writes
- synchronization queues or workers
- device registration
- auth redirect configuration

See [deployment.md](deployment.md) for the implemented setup.
