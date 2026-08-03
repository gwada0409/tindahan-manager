# Financial synchronization

Supported modules are Utang, GCash, bills, employees/payroll, and vault. Immutable entries merge by UUID and balances are recomputed from all entries. Bill payment and employee changes use record versions.

Never edit completed ledger entries to correct money. Add an adjustment or reversal through the existing module workflow. Queue entries remain until the server confirms their operation receipt.

Expenses and supplier payments have no local data model or workflow and are not synchronized. Sale-created Utang and GCash effects continue to be handled atomically by the sale transaction RPC.