# Phase 5: Authentication and store ownership

Status: Implemented locally; remote migration and hosted email flows require project deployment verification  
Date: 2026-07-31

> Subsequent status (Phase 6): the store-scoped business schema and RLS policies are now implemented in migration source. This record otherwise describes Phase 5.

## Completed scope

Phase 5 replaces the forgeable production login simulation with an optional Supabase Auth adapter. It implements sign-up, email/password sign-in, session restoration with server verification, local-scope sign-out, confirmation redirects, password recovery/update, auth-state subscription, active membership lookup, multi-store selection, device registration, and device-bound offline reopening.

The development server retains password-free local Admin/Staff access behind `import.meta.env.DEV`. Production bundles do not render it. Legacy hard-coded passwords are removed, and restoration deletes the old `tindahan_auth_session` value.

## Cloud ownership model

The source-controlled migration `supabase/migrations/202607310001_phase5_auth_ownership.sql` adds:

- `stores`: store identity and immutable owning Auth user;
- `store_members`: active owner, administrator, cashier, or staff membership;
- `devices`: per-user/per-store browser registration with revocation state;
- membership helper functions used by RLS;
- an authenticated, idempotent `create_store_with_owner` RPC.

All three tables enable RLS. Authenticated users can read stores they actively belong to, read memberships within their stores, and register/update only their own devices. Owner memberships cannot be modified through normal member policies. The application checks `revoked_at` during online device registration.

Only ownership tables are cloud-backed. Phase 6 must introduce the store-scoped business schema, business RLS, and operation semantics.

## Account lifecycle

1. Sign-up sends display/store names as Auth metadata and uses a base-aware confirmation redirect.
2. If email confirmation is enabled, the user confirms before the first session.
3. On first verified login, the owner-store RPC creates the store/membership when no membership exists.
4. One membership is selected automatically; multiple memberships open the store selector.
5. The browser device is registered, then a minimal verified identity is cached locally.
6. Auth events refresh or clear application state.
7. Password recovery redirects to `#/reset-password` and updates the active recovery session.
8. Sign-out clears account caches but leaves all Dexie business records intact.

## Offline contract

Offline reopening is allowed only after a successful online verification and only when the cached device ID matches the browser's persistent device ID. The cache stores user/store/display/role/device fields and a timestamp, not a password.

If Supabase is reachable but the session is absent or invalid, cached identity is not accepted. If Supabase is unreachable, a matching cache opens an explicit offline mode. Cloud access and first login on another device remain unavailable. Sign-out clears the cache.

Pending local records are counted before sign-out. The user must confirm when unsynchronized records exist; continuing still preserves those records locally.

## Role compatibility

| Cloud membership | Existing local permission role |
|---|---|
| Owner | Admin |
| Administrator | Admin |
| Cashier | Employee |
| Staff | Employee |

This preserves the established application permission matrix while the cloud stores the more precise membership role.

## Redirect and deployment contract

The Supabase client uses PKCE. Redirects are derived from `window.location.origin + import.meta.env.BASE_URL` and retain hash routing:

```text
Local:  https://localhost:5173/#/reset-password
Pages:  https://gwada0409.github.io/tindahan-manager/#/reset-password
```

Supabase Auth URL Configuration must allow local origins and `https://gwada0409.github.io/tindahan-manager/**`. Exact production URLs are preferred over broad wildcards. A future custom domain needs matching Site URL/redirect entries and `VITE_DEPLOY_BASE=/`.

## Data preservation and migrations

No Dexie migration was added; the local database remains version 4. Phase 5 never deletes, renames, relabels, or uploads existing business rows. Cloud ownership IDs are authentication context only until a later explicit linking/sync phase.

The Supabase migration is additive for a project that does not already define these objects. Applying it to a project with conflicting names/types requires a reviewed forward migration rather than deleting existing tables.

## Verification completed

- direct TypeScript check passed;
- Vitest passed 16 files and 47 tests;
- production build passed and generated a 10-entry PWA precache;
- local production UI smoke testing passed for sign-up fields, recovery routes, protected-route redirect, production quick-access exclusion, and console errors; development access is covered by service tests;
- lint remains blocked before source analysis because the repository lacks `eslint.config.*`.

A live Supabase project and email provider were not supplied, so real signup email delivery, redirect exchange, migration execution, device revocation, and adversarial RLS checks remain deployment verification items.

## Rollback

Revert the Phase 5 frontend and documentation while retaining IndexedDB v4 declarations. Do not remove cloud tables after they contain real ownership data. Disable the auth UI or deploy a forward migration instead. Local business data does not require rollback because Phase 5 does not mutate its schema or contents.