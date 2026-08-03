# Phase 16 — Realtime and device management

Status: completed locally on 2026-08-01

## Delivered

- Added store-filtered Supabase Realtime subscriptions across synchronized tables.
- Debounces event bursts for 750 ms and invokes the existing incremental synchronization engine.
- Ignores event payloads; Dexie remains the UI database and incremental pull remains authoritative.
- Retains the 60-second periodic sync for missed-event recovery.
- Records platform/browser device names during registration and best-effort last activity/last successful sync times.
- Adds an owner-only Settings panel listing device ID, name, registration, activity, sync, current-device, and revocation state.
- Adds an owner-only revocation RPC. Existing RLS/RPC device checks reject future writes from revoked registrations.
- Explicitly warns that an offline revoked device retains local data until reconnection.

## Data and deployment

No Dexie schema changed. The additive Supabase migration adds one nullable device timestamp, policies/RPC, and publication membership; it does not rewrite business rows. Apply `202608010004_phase16_realtime_devices.sql` after all earlier migrations.

## Verification

- TypeScript project build: passed.
- Phase 16 contract tests cover owner authorization, irreversible revocation, publication coverage, debounce, and periodic recovery.
- Vitest: 33 files and 116 tests passed.
- Production/PWA build: passed (2,867 modules; 10 precache entries).
- ESLint: unavailable because the repository has no ESLint 9 flat configuration.
- Diff whitespace and credential-value review: passed.
- Live Realtime delivery, migration application, and pgTAP require a configured Supabase environment and remain deployment checks.

## Phase 21 update

Phase 16 originally made revocation irreversible. Phase 21 supersedes that limitation with a separate owner-only Restore action and RPC; direct unrevocation remains blocked.
