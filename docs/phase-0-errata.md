# Phase 0 audit note

The earlier draft incorrectly stated that Phase 0 changed `.gitignore`. That statement has now been corrected directly in `offline-sync-refactor.md` and `README.md`.

The authoritative baseline remains:

- plain `.env` is **not currently ignored**;
- no real `.env` exists or is tracked;
- do not create or commit real credentials until the dedicated environment-configuration phase adds the appropriate ignore rules;
- Phase 0 changes documentation only; there is no `.gitignore` change to revert.
