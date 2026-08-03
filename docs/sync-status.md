# Sync statuses and troubleshooting

The status pill is visible globally after opening the application. Select it for details and **Retry sync**.

| Status | Meaning |
|---|---|
| Offline mode | The browser is offline. Work remains saved in local IndexedDB. |
| Online | The account and cloud connection are ready; nothing is currently queued. |
| Pending changes | Local work is saved and durable queue items await cloud acknowledgement. |
| Syncing | A push-then-pull run is active. |
| Synced | The latest run finished without queued failures. |
| Sync failed | The run ended safely with an error; local work remains available. |
| Authentication required | Cloud sync needs a verified online account session. |
| Conflict detected | Independent mutable edits require administrator review. |
| Cloud unavailable | The application is online locally, but configured cloud services cannot currently be reached. |

The expanded diagnostics are local operational evidence, not proof that another device is online. Last successful sync is populated only after a complete run. A missing cursor means no pull page has yet been committed for the store. Phase 22 also recovers current-device records that older builds queued under `local-store-unassigned` after account linking; the next verified online run reassigns and uploads them instead of continuing to report a false empty queue.

For recovery, confirm connectivity, sign in again if required, then select **Retry sync**. Resolve reported conflicts from the administrator Conflicts page. Do not clear browser storage as a troubleshooting shortcut: export first, and remember that reset deletes all local records and pending queue operations.