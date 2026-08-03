# Device management and revocation

Store owners manage registered browsers under **Settings → Store devices** while online. Each row shows its stable device ID, browser/platform name, registration, last activity, last successful sync, current-device marker, and revocation time.

Revoking a device is permanent for that registration. Future cloud writes fail because every synchronized write validates the unrevoked device. The revoked browser cannot clear its own revocation. If it was offline when revoked, it can still read and change its local IndexedDB until it reconnects; those changes cannot upload under the revoked registration. Revocation does not remotely erase browser storage or substitute for physical-device controls.

Realtime is only a responsiveness mechanism. A notification schedules a debounced authenticated incremental pull. It does not copy event payloads into the application. Periodic synchronization continues every 60 seconds to recover missed notifications.

After revoking a lost device, also secure the associated account/session as appropriate. Preserve the owner’s current device unless intentionally testing its loss of future cloud access.