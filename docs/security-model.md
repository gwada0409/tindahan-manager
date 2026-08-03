# Security model

Status: Phase 19 additive hardening implemented; Phase 20 sync repair verified
Date: 2026-08-03

## Trust boundaries

The browser, GitHub Pages bundle, publishable Supabase key, IndexedDB, cached offline identity, and frontend roles are not trusted authorization boundaries.

Cloud authorization is enforced by:

1. a valid Supabase Auth session;
2. `auth.uid()` matching an active store membership;
3. the membership's database role;
4. an unrevoked device registered to that user and store;
5. store-scoped foreign keys and RLS checks;
6. operation-ID constraints for event/transaction records.

Offline identity permits local application reopening only. It does not authorize cloud access.

## Role model

| Capability | Owner | Administrator | Cashier | Staff |
|---|---:|---:|---:|---:|
| Read store business rows | Yes | Yes | Yes | Yes |
| Catalog, inventory, customer, bill writes | Yes | Yes | Yes | Yes |
| Soft-delete synchronized master data | Yes | Yes | No | No |
| Append sales, utang, GCash, stock and audit events | Yes | Yes | Yes | Yes |
| Employee management | Yes | Yes | No | No |
| Payroll and vault inserts | Yes | Yes | No | No |
| Store settings | Yes | Yes | No | No |
| Manage administrators | Yes | No | No | No |
| Manage cashier/staff memberships | Yes | Yes | No | No |

This preserves the current UI permission mapping: owner/administrator correspond to local `admin`; cashier/staff correspond to local `employee`.

## RLS helpers

Security-definer policy helpers live in the non-exposed `private` schema; only the validated store-creation RPC remains in `public`.

- `private.is_active_store_member(store_id)` verifies active membership.
- `private.has_store_role(store_id, roles[])` verifies membership plus role.
- `private.is_registered_device(store_id, device_id)` verifies ownership and revocation state.
- `private.can_write_business(...)` binds the row's actor/device/store to `auth.uid()`.

Helpers are `SECURITY DEFINER`, set a controlled `search_path`, revoke public execution, and expose only the minimum authenticated calls needed by policies.

## Row policies

All business tables enable RLS. Active members can read their store's rows. Writes require a permitted role and registered device. Store-scoped composite foreign keys prevent cross-store relationships even when IDs are supplied manually.

Authenticated clients receive no update/delete policies or grants for sales, sale items, stock movements, utang, GCash, payroll, vault, audit, or operation receipts. Completed financial/event rows therefore cannot be silently overwritten through the public client.

Mutable tables use updates and soft deletion. A trigger restricts deletion-state changes to owners and administrators. No business table grants authenticated hard deletion.

## Ownership protections

Direct store updates cannot change `owner_user_id`. Owner memberships cannot be inserted, updated, or deleted through membership policies. Administrators cannot create or modify administrator memberships; only owners can.

User deletion may remove that user's Phase 5 membership/device rows, but owned stores use a restrictive owner foreign key and cannot be silently cascaded away.

## Device limitations

A revoked device is rejected by online write policies and cannot clear its own revocation timestamp. An already-offline browser cannot learn of revocation until it reconnects. Local IndexedDB remains accessible to someone who controls the browser profile/device.

Phase 16 exposes device listing only to the store owner and performs revocation through a validated owner-only security-definer RPC. Revocation is permanent for that registration and blocks future cloud writes. Device last activity and successful sync times are operational metadata, not a guarantee of physical-device security.

## Operation and transaction protections

Authenticated transaction RPCs derive the actor from `auth.uid()`, validate membership, role, store, registered device, payload, and operation ID, and commit related records atomically. Unique operation receipts make retries idempotent. Realtime grants no additional write authority and is used only to request an authenticated incremental pull.

## Verification

Automated Vitest checks verify the migration's policy contract. The disposable pgTAP script tests two-store isolation, a cashier's manager-only write denial, and duplicate operation rejection.

Before production:

1. apply both migrations to a disposable Supabase branch/project;
2. run the pgTAP test;
3. regenerate TypeScript types;
4. test each role with real authenticated sessions;
5. verify no table is readable through the anonymous key;
6. inspect policies in the Supabase dashboard;
7. repeat adversarial cross-store relationship tests.

## Secrets

Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` belong in the browser build. Never expose a service-role key, secret key, database password, JWT signing secret, or private backend credential. GitHub Actions secrets do not make compiled `VITE_` values private.


## Phase 8 trusted push boundary

The public push RPC is `SECURITY DEFINER` because it must atomically process an entity and its operation receipt. It derives the actor from `auth.uid()`, calls private membership/device validation, restricts supported entity types and batch size, validates store/payload identity and versions, and grants execution only to `authenticated`. The browser never receives a privileged key.
## Phase 9 pull boundary

The pull RPC requires active membership for the requested store, enforces a bounded page size, and returns only the four supported RLS-protected entity types. Its cursor is based on trigger-owned server time rather than the browser clock.
## Phase 16 Realtime boundary

Synchronized tables join the `supabase_realtime` publication. Clients subscribe with a store filter, discard event row payloads, debounce notifications, and invoke the existing push/pull engine. RLS and validated RPCs remain the authorization boundary. Owners can read store device registrations and call `revoke_store_device`; administrators and staff cannot use that RPC.
## Phase 19 hardening

The Phase 19 migration forces RLS on every implemented ownership and business table, removes all anonymous table grants, and explicitly removes `public`/`anon` execution from application RPCs. Authenticated execution remains available only through grants established by the owning migrations. New or changed store, category, supplier, product, customer, and employee names have bounded lengths. Audit actions and detail payloads are bounded; constraints are `NOT VALID`, so existing rows are not scanned or rewritten.

The static app supplies a Content Security Policy that restricts scripts, workers, manifests, forms, framing primitives, and object embedding to the application origin. Supabase connectivity remains possible over HTTPS/WSS. Inline styles remain allowed because the current React/Tailwind implementation uses them. GitHub Pages cannot set authoritative response headers, so a reverse proxy or different host should set CSP and related headers for stronger enforcement.

React text rendering escapes user-provided strings and the application does not use `dangerouslySetInnerHTML`. Backups contain sensitive business data, remain user-managed files, and are neither encrypted nor uploaded automatically. Restore audit records contain metadata and counts only, never backup contents or credentials.

No offline PIN is implemented. Adding one requires a memory-hard password derivation design, per-device salt, throttling, and an explicit threat-model review; a directly stored PIN is prohibited.

Existing RPCs enforce authenticated membership/device context and bounded page/batch inputs. Application-level distributed rate limiting is not implemented because GitHub Pages has no trusted server; production operators should configure Supabase/platform abuse controls and monitor Auth/RPC activity.

## Security reporting

Do not put credentials, customer records, backup files, or exploitable details in a public issue. Use GitHub private vulnerability reporting when the repository enables it, or request a private owner contact channel without disclosing sensitive evidence publicly.