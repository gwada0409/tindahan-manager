# Phase 19 — Security hardening

Status: implemented locally; live Supabase verification pending  
Date: 2026-08-03

## Completed scope

- Added an additive migration that forces RLS across every implemented cloud table and revokes all anonymous table privileges.
- Explicitly revoked `public` and `anon` execution on every application-facing RPC while retaining the existing authenticated grants.
- Added non-rewriting `NOT VALID` length/size constraints for newly written user text and audit payloads.
- Added a GitHub Pages-compatible CSP and no-referrer policy. HTTPS/WSS is retained for configured Supabase connectivity; inline styles remain necessary for the current UI.
- Added a local audit event after a validated transactional backup restore. Only backup metadata and record counts are logged.
- Reviewed browser identity storage: the cached identity contains no password, token, PIN, or privileged credential and grants no cloud authority.
- Confirmed that no `dangerouslySetInnerHTML` rendering path is implemented; React escaping remains the user-content boundary.
- Documented backup sensitivity, lack of backup encryption, lack of an offline PIN, platform rate-limiting limitations, and private vulnerability reporting guidance.

## Compatibility and data safety

There is no Dexie migration. The PostgreSQL migration does not update or delete business records. `NOT VALID` constraints avoid an existing-row validation scan but apply to future inserts and relevant updates. Forced RLS and grant removal can expose incorrect deployment assumptions, so the migration must be tested in a disposable Supabase environment before production.

## Verification

Automated security-contract tests cover forced RLS, anonymous grant removal, RPC lockdown, and bounded new payloads.

- TypeScript project build: passed.
- Vitest: passed, 36 files and 127 tests.
- Vite production/PWA build: passed, 2,867 modules and 10 precache entries.
- Credential and unsafe-rendering scans: passed with no findings.
- Diff validation: passed; Git reported only existing LF-to-CRLF notices.
- ESLint: unavailable because ESLint 9 requires a flat configuration that is not present.
- Live policy and pgTAP verification: unavailable because Supabase CLI/runtime tooling is not installed.

## Manual checks

1. Apply all migrations to a disposable Supabase project.
2. Verify anonymous selects and RPC calls fail.
3. Verify each authenticated role can perform only its documented operations.
4. Test cross-store foreign keys and RLS with two real users/stores.
5. Verify the built app signs in, synchronizes through HTTPS/WSS, installs, and relaunches offline under the CSP.
6. Restore a validated backup and confirm a `backup:restore` local audit entry is created.

## Rollback

Revert the app/CSP and restore-audit changes together if browser compatibility regresses. For the cloud migration, create a reviewed forward migration that removes only the affected constraints or `FORCE ROW LEVEL SECURITY`; do not roll back by disabling RLS or granting anonymous access. Existing user data requires no restoration.