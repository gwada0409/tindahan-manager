# Inventory ledger and reconciliation

Current stock is the sum of signed movements for each batch. remainingQuantity is a transactional cache used by the UI and allocation code.

Movement signs:

- restock, return, and transfer-in are positive;
- sale, damaged, expired, and transfer-out are negative;
- adjustment may be positive or negative.

Local operations block negative stock unless the store setting explicitly allows it. Multiple offline devices cannot reserve against each other. The server therefore accepts unique movements, preserves completed sales, and flags a negative merged balance for review.

The Inventory page compares each cached batch quantity with the sum of local movements. A discrepancy usually indicates pre-Phase-11 sales, an incomplete legacy baseline, or interrupted imported history. Export a backup, inspect the batch and movement records, and create a reviewed adjustment; do not edit or delete old movements.

New-device reconstruction pulls batches and then applies every unique movement. A duplicate page or repeated operation UUID does not change stock twice.