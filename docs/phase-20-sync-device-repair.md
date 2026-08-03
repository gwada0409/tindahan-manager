# Phase 20: Sync device repair

Phase 20 repairs the deployed Phase 16 device and Realtime setup without rewriting business records.

## Problem

Supabase API logs showed repeated `PATCH /rest/v1/devices` responses with status `400` and `PGRST204`. The live `devices` table did not have the `last_sync_at` column used after successful push and pull runs.

The Phase 16 migration also referenced `public.has_store_role`, but Phase 6 had moved the security-definer helper to `private.has_store_role` and removed the public function. That prevented the remaining Phase 16 statements from being applied.

## Implemented repair

The additive repair migration:

- Adds `devices.last_sync_at` with `add column if not exists`.
- Creates the owner device-read policy only when it is missing.
- Uses `private.has_store_role` for owner authorization.
- Recreates the owner-only `revoke_store_device` RPC with restricted privileges.
- Registers all 14 synchronized tables with `supabase_realtime` only when missing.
- Reloads the PostgREST schema cache after the repair.

The original Phase 16 migration now uses the same rerunnable checks, so fresh installations and existing installations follow the same authorization model.

## Deployment

Apply `supabase/migrations/202608030003_phase20_sync_device_repair.sql` after the Phase 19 migration. The migration does not delete, reset, or rewrite existing store, inventory, sale, financial, or authentication data.

## Verification

The deployed project was checked for the repaired column, owner policy, revocation RPC, and Realtime publication membership. All checks passed, including registration of all 14 synchronized tables.
