# Backup and recovery guide

## Create a backup

Open **Settings → Data Management** and choose **Export Backup (JSON)**. Store the downloaded file outside the browser profile—preferably on another trusted device or encrypted storage. The file contains all local business and synchronization tables and is not encrypted.

Each export includes schema/application version, store and device IDs, export time, table counts, and a SHA-256 checksum. Do not edit the JSON: any change invalidates the checksum.

## Restore

Choose **Import Data**, select a Phase 17 backup, review the record count/export time, and confirm replacement. The application validates the entire file before opening a write transaction. It then stores the current database as an IndexedDB recovery point and replaces all tables atomically. Invalid, truncated, modified, wrong-version, or incomplete files leave active data unchanged.

Restoring a file also restores its queue, conflict, and migration state. Sign in online afterward and inspect sync status before retrying uploads. The device identity used for future writes remains the browser’s persistent identity; imported record envelopes retain historical device IDs for audit/sync purposes.

## New or lost devices

A backup file provides the complete local-history restore path on a new browser. Cloud account linking can reconstruct supported pull entities, but currently does not download completed sales or local-only Notes/Services. For full history, restore the latest exported file, then authenticate and synchronize.

## Reset and browser clearing

**Reset All Data** first downloads a checksummed `pre-reset` backup, then deletes IndexedDB. Confirm that the download completed before relying on it. Browser “clear site data,” profile deletion, disk cleanup, private browsing, or device loss bypass application safeguards and can destroy local-only data.

## Failed account linking or restore

Account linking creates an IndexedDB snapshot before destructive work and records resumable progress. A validated file restore creates another local recovery point. These internal points help with forward recovery but disappear if browser storage is cleared. Preserve the browser profile, do not downgrade Dexie, and use a reviewed forward repair or the latest downloaded backup.