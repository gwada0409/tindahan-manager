# Phase 3: GitHub Actions and GitHub Pages

Status: Completed in repository; external deployment requires repository configuration  
Date: 2026-07-31

## Scope completed

- replaced the combined deployment job with dependent build and deploy jobs;
- updated the workflow to current official action majors;
- standardized the workflow on Node.js 22 and lockfile installation;
- added tests and optional typecheck execution before build;
- retained lint execution as non-blocking while the known missing flat config remains;
- validated and injected the two public Supabase repository secrets;
- added the official Pages configuration and artifact steps;
- restricted permissions by job;
- changed local Vite base to `/`;
- retained `/tindahan-manager/` for repository Pages builds;
- added a `VITE_DEPLOY_BASE` override for future custom domains;
- preserved HashRouter and all Vite/PWA plugins;
- documented Pages enablement, secrets, triggers, failure inspection, and custom-domain behavior.

## Preserved behavior

No React route, business feature, IndexedDB schema, local record, authentication behavior, or synchronization behavior changed. Local development now uses Vite's root base while the application continues using hash routes.

## External activation required

The repository owner must:

1. add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as Actions repository secrets;
2. select GitHub Actions as the Pages publishing source;
3. push the workflow to `main` or run it manually;
4. verify the published URL and Pages environment.

These external settings were not changed from the local workspace.

## Final verification

| Check | Result |
|---|---|
| Workflow YAML parse and required-job check | Passed: `build`, `deploy` |
| Forced TypeScript project build | Passed |
| Vitest regression suite | Passed: 12 files, 37 tests |
| Local development root | Passed: HTTP 200 at `/` |
| Local-root production asset paths | Passed |
| Repository Pages asset paths | Passed |
| Repository Pages preview | Passed: page and JavaScript asset HTTP 200 |
| Custom-domain root override | Passed |
| Privileged-value assignment scan | Passed: zero matches |
| Diff whitespace check | Passed |
| ESLint | Could not analyze source because the existing ESLint 9 flat configuration is missing; workflow step is non-blocking |

All three builds generated PWA output and retained the existing bundle-size warning. An actual GitHub-hosted workflow run was not possible from the local workspace because the changes were not pushed and repository settings/secrets were not modified.

## Follow-up status after Phase 4

Phase 4 completed the PWA manifest, icon, start URL, scope, offline-route, and update-notification work. See [the Phase 4 routing and PWA record](phase-4-routing-pwa.md).

The following work remains:

- Supabase authentication callback handling;
- actual cloud authentication, schema, RLS, and synchronization;
- blocking lint enforcement after an ESLint flat configuration exists.
