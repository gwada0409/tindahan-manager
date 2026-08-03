# Conflict resolution guide

Only administrators with `settings:manage` can open **Conflicts**. Review the entity ID, base version, complete local/cloud values, editor, device, and update time before choosing.

- **Keep this device** preserves the local mutable record, rebases it on the observed cloud version, and retries its queued upload.
- **Keep cloud** replaces the mutable local record and removes obsolete queued edits for that entity.
- **Merge fields** is disabled unless a trustworthy common-base snapshot exists. Current pull conflicts record the base version but do not retain that snapshot, so the application does not guess.
- Completed sales, stock movements, Utang, GCash, payroll, and vault entries cannot be overwritten. Create a void/refund/reversal, stock movement, payment, or other compensating entry in the relevant module.

Resolution is local-first and audited. After keeping a local value, run **Sync now** while online. After keeping cloud, the blocked pull cursor can continue on the next synchronization run.

Do not clear browser storage to resolve a conflict. Export a backup before any manual database recovery. If neither displayed value is trustworthy, leave the item unresolved and investigate the source devices and audit log.