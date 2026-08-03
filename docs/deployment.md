# GitHub Pages deployment and public Supabase configuration

Status: Phase 6 cloud schema and RLS completed in source control; hosted deployment and remote migration still require repository/project configuration  
Date: 2026-07-31  
Expected URL: `https://gwada0409.github.io/tindahan-manager/`

This document describes the implemented build/deployment, Auth configuration, and ordered Phase 5/6 migrations. The migrations provide RLS-protected ownership and business tables. Business synchronization is not implemented.

## Local public configuration

Copy the committed placeholder to an ignored local file:

```bash
cp .env.example .env
```

On PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill only the public values:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-public-publishable-key
```

The client temporarily accepts `VITE_SUPABASE_ANON_KEY` when the publishable key is absent. Restart Vite after changing environment values.

Local environment files are ignored. The publishable key is embedded in the public frontend bundle. Phase 5 ownership and Phase 6 business tables require Supabase Auth and their included RLS policies. The browser synchronizes the supported business records only after authenticated membership and registered-device validation. Never use a service-role key, secret key, database password, JWT signing secret, or other private credential.

## Required GitHub repository secrets

Create exactly these repository secrets:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

GitHub path:

```text
Repository
-> Settings
-> Secrets and variables
-> Actions
-> New repository secret
```

The workflow checks that both values are present before building and does not print them. GitHub masks secrets in workflow logs, but the resulting `VITE_` values remain inspectable in the browser bundle.

## Supabase Auth and ownership setup

Apply migrations in timestamp order before enabling production accounts or future synchronization:

```text
supabase/migrations/202607310001_phase5_auth_ownership.sql
supabase/migrations/202607310002_phase6_business_schema_rls.sql
supabase/migrations/202607310003_phase8_push_sync_rpc.sql
supabase/migrations/202607310004_phase9_pull_sync_rpc.sql
supabase/migrations/202608010001_phase11_sales_sync.sql
supabase/migrations/202608010002_phase12_inventory_sync.sql
supabase/migrations/202608010003_phase13_financial_sync.sql
supabase/migrations/202608010004_phase16_realtime_devices.sql
supabase/migrations/202608030001_phase18_retention_indexes.sql
supabase/migrations/202608030002_phase19_security_hardening.sql
supabase/migrations/202608030003_phase20_sync_device_repair.sql
```

Apply every migration in timestamp order. Later migrations add transactional sales, movement-based inventory, financial ledgers, Realtime publication, device sync timestamps, and owner revocation. Phase 20 safely repairs Phase 16 on existing projects and must be applied even when the earlier file was attempted manually. Phase 18 adds receipt-retention cleanup and operational indexes.

In **Authentication -> URL Configuration**, set the production Site URL and allow redirects for:

```text
http://localhost:5173
http://localhost:5173/**
https://localhost:5173/**
https://127.0.0.1:5173/**
https://gwada0409.github.io/tindahan-manager/**
```

The client uses PKCE and builds redirects from the current origin plus Vite's resolved base. This keeps local, repository-subpath, and future root-domain builds aligned. Prefer exact production paths when practical. Add the future custom domain separately; never remove the repository URL while it still serves users.

Signing out preserves IndexedDB data. Supabase sessions and the minimal verified offline identity are browser-local. A first login on another browser/device must reach Supabase.

## Database migration verification

Use a disposable local Supabase project first:

```bash
supabase start
supabase db reset
supabase test db
supabase gen types typescript --local
```

After reviewing the local result and generated type diff, link the intended remote project, inspect pending migrations, and run:

```bash
supabase db push
```

Do not run `db reset` against production. The workspace used for Phase 6 had no Supabase CLI, PostgreSQL client, Docker runtime, or configured project, so remote migration execution and pgTAP results are not claimed. See [database-schema.md](database-schema.md) and [security-model.md](security-model.md).

## Enable GitHub Pages

Select GitHub Actions as the publishing source:

```text
Repository
-> Settings
-> Pages
-> Build and deployment
-> Source
-> GitHub Actions
```

The workflow runs after pushes to `main` and through the manual `workflow_dispatch` action.

## Implemented workflow

`.github/workflows/deploy.yml` has separate `build` and `deploy` jobs.

The build job:

1. checks out the repository;
2. installs Node.js 22 with npm caching;
3. runs `npm ci --legacy-peer-deps`;
4. invokes the optional typecheck script when present;
5. runs the existing lint script as non-blocking because its ESLint 9 flat configuration is still missing;
6. runs the complete Vitest suite;
7. validates both public Supabase values;
8. builds with the public values and optional deployment-base variable;
9. configures Pages;
10. uploads `dist` as the Pages artifact.

The deploy job waits for a successful build, receives only `pages: write` and `id-token: write` permissions, deploys the Pages artifact, and reports the resulting URL through the `github-pages` environment.

The workflow uses the current official major actions documented during Phase 3:

- `actions/checkout@v6`
- `actions/setup-node@v6`
- `actions/configure-pages@v5`
- `actions/upload-pages-artifact@v4`
- `actions/deploy-pages@v4`

## Base-path behavior

Vite resolves its base as follows:

| Context | Base |
|---|---|
| Local development or local build | `/` |
| GitHub Actions repository deployment | `/tindahan-manager/` |
| Explicit `VITE_DEPLOY_BASE` | Normalized override |

The application continues using `HashRouter`, so deployed routes use URLs such as:

```text
https://gwada0409.github.io/tindahan-manager/#/login
```

For a future custom domain, create the repository Actions variable `VITE_DEPLOY_BASE` with the value `/`. This is a public path, not a secret. Configure the custom domain in GitHub Pages settings as required by GitHub.

## PWA paths, offline shell, and updates

The Pages build emits manifest, icon, JavaScript, CSS, and service-worker URLs under `/tindahan-manager/`. Manifest `id`, `start_url`, and `scope` are relative (`.`), so `VITE_DEPLOY_BASE=/` also produces a root-scoped custom-domain build.

The worker precaches only the static application shell and supplies cached `index.html` for in-scope navigations after installation. No runtime cache handles Supabase or other API responses. When a changed worker is waiting, the application offers **Update** or **Later** instead of forcing a reload.

Canonical routes retain the hash:

```text
https://gwada0409.github.io/tindahan-manager/#/inventory
```

Do not publish route links such as `/tindahan-manager/inventory`; GitHub Pages has no general SPA fallback for a first request to that path. Implemented Auth routes use the same base-aware hash contract: `#/login`, `#/forgot-password`, `#/reset-password`, and `#/select-store`.

See [the Phase 4 routing and PWA record](phase-4-routing-pwa.md) for build-output and browser verification.
## Inspect deployment failures

1. Open the repository's **Actions** tab.
2. Select **Deploy Tindahan Manager**.
3. Open the failed workflow run and the failed `build` or `deploy` job.
4. Expand the failing step.
5. Correct missing secrets, installation/test/build failures, Pages-source configuration, or environment protection rules.
6. Use **Run workflow** to retry manually after fixing configuration.

The workflow intentionally fails before the build if either required public value is absent. Lint currently reports its known configuration error without blocking deployment.

## Local verification

Run:

```bash
npm test
npm run build
```

To simulate the repository Pages base locally, set `GITHUB_ACTIONS=true` for the build and preview `/tindahan-manager/`. To simulate a custom domain, also set `VITE_DEPLOY_BASE=/`. Phase 4 additionally verified direct hash routing, refresh, back/forward, protected-route redirects, offline relaunch with the server stopped, and waiting-worker activation.

## Current limitations

- The updated workflow cannot deploy until it is pushed and repository Pages/secrets are configured.
- Supabase account/ownership calls are implemented but require configured public values and both applied migrations.
- Supabase redirect allowlist and email delivery still require project-dashboard configuration.
- A browser-native install click-through still requires a deployed-device smoke test.
- ESLint remains non-blocking because no flat config exists.
- The main bundle retains its size warning.
