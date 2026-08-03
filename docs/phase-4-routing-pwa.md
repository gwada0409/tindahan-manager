# Phase 4: GitHub Pages routing and PWA lifecycle

Status: Completed and verified against a local Pages-subpath artifact  
Date: 2026-07-31  
Expected deployed URL: `https://gwada0409.github.io/tindahan-manager/`

> Subsequent status (Phase 5): base-aware Supabase confirmation and recovery routes are now implemented. The remainder of this record describes the Phase 4 completion state.

## Scope completed

- retained React `HashRouter`, so application routes remain after the repository subpath and `#`;
- made favicon and Apple touch icon URLs follow Vite's resolved base path;
- set relative manifest `id`, `start_url`, and `scope` values so the same build configuration works under the repository subpath or a future root custom domain;
- added real 192x192 and 512x512 PNG install icons, a separate padded 512x512 maskable icon, and a 180x180 Apple touch icon;
- configured Workbox to precache the static application shell, remove outdated caches, and return `index.html` for in-scope navigations after installation;
- changed service-worker activation from automatic reload to a user-controlled prompt;
- added an accessible notification when the shell becomes available offline and when a new worker is waiting;
- added tests for offline-ready dismissal, update activation, and update deferral;
- verified the production output and routing behavior under `/tindahan-manager/`.

No IndexedDB schema, Supabase schema, local record, business service, permission, or authentication implementation changed.

## Routing contract

GitHub Pages does not provide a general single-page application fallback. The application therefore keeps hash routes, which do not send the route segment to the static host.

| Behavior | URL shape | Verified result |
|---|---|---|
| Application root | `/tindahan-manager/` | Loads the shell and redirects an unauthenticated session to `#/login` |
| Public login | `/tindahan-manager/#/login` | Loads directly and on refresh |
| Protected route | `/tindahan-manager/#/inventory` | Loads for a local authenticated session |
| Protected route without session | `/tindahan-manager/#/inventory` | Redirects to `#/login` |
| Browser history | Hash routes | Back and forward restored Inventory and Sales |

A path such as `/tindahan-manager/inventory` is not a supported first-load URL on GitHub Pages. Use `/tindahan-manager/#/inventory`.

Supabase Auth callbacks and password-reset routes are not implemented. Phase 4 therefore does not claim or test password-reset callback behavior.

## Manifest and service worker

The Pages-mode build emits:

- `manifest.webmanifest` with `id`, `start_url`, and `scope` set to `.`;
- manifest and icon links under `/tindahan-manager/`;
- service-worker registration at `/tindahan-manager/sw.js` with scope `/tindahan-manager/`;
- a precache containing `index.html`, compiled CSS and JavaScript, the Workbox client, manifest, favicon, Apple icon, and all install icons;
- an in-scope navigation fallback to the cached `index.html`;
- outdated-cache cleanup.

No `runtimeCaching` rule is configured. Supabase API, Auth, Storage, Functions, and Realtime responses are not added to Workbox caches.

## Update behavior

When a changed worker reaches the waiting state, the application displays **A new version is available** with:

- **Update**, which asks the worker to activate and reloads under the new controller;
- **Later**, which dismisses the notification without forcing a reload;
- a separate dismiss button with an accessible label.

A completed first installation can display **App is ready to work offline**. This message can also be dismissed.

## Verification performed

The production Pages-mode build was served from a local HTTP localhost harness that preserved the exact `/tindahan-manager/` directory layout. Localhost is a secure service-worker context and avoids Vite's self-signed HTTPS certificate, which the automated browser correctly rejected.

| Check | Result |
|---|---|
| Manifest JSON and relative start URL/scope/id | Passed |
| Icon files and declared dimensions | Passed: 180, 192, and 512 pixel assets |
| Pages-subpath HTML, assets, manifest, and worker paths | Passed |
| Root and direct hash route | Passed |
| Refresh on `#/inventory` | Passed |
| Browser back/forward between Inventory and Sales | Passed |
| Protected-route redirect | Passed |
| Offline-ready notification | Passed |
| Offline reload with the static server stopped | Passed |
| Offline launch from `/tindahan-manager/` | Passed; resolved to `#/login` |
| Waiting-worker notification | Passed with a changed-worker probe |
| Update activation and reload | Passed |
| Component regression tests | Passed: 2 tests |
| Auth/password-reset callback | Not applicable; not implemented |

The automated browser verified installability prerequisites and offline launch behavior, but it did not expose a browser-native Install UI for an end-to-end click-through. A real deployed-device install remains a post-deployment smoke test.

## Data and security boundary

The service worker caches only versioned static shell files and the navigation fallback. It does not cache API responses or change IndexedDB contents. Clearing site storage still removes both local application data and PWA caches; export valuable local data before doing so.

Authentication remains the development-only local simulation described in the README. The Pages route guard is not a security boundary.

## Rollback

Rollback can restore the previous `vite.config.ts`, `index.html`, `src/App.tsx`, PWA notification files, and generated icons without touching IndexedDB. Browsers that already installed the Phase 4 worker may retain its static cache until a replacement worker activates or site storage is cleared. Do not clear site storage on a device with valuable unexported records merely to roll back the application shell.

## Deferred work

- actual GitHub-hosted deployment and device install smoke test;
- Supabase Auth callback and password-reset routing;
- cloud schema, RLS, synchronization, and conflict handling;
- an ESLint 9 flat configuration;
- production bundle code splitting.
