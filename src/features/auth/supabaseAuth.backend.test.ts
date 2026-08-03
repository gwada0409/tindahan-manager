import { describe, expect, it } from 'vitest';
import { parseMembershipRows } from './supabaseAuth.backend';

describe('Supabase membership parsing', () => {
  it('accepts active supported roles and joined store shapes', () => {
    expect(parseMembershipRows([
      { role: 'owner', active: true, stores: { id: 'one', name: 'Main' } },
      { role: 'cashier', active: true, stores: [{ id: 'two', name: 'Branch' }] },
    ])).toEqual([
      { storeId: 'one', storeName: 'Main', role: 'owner' },
      { storeId: 'two', storeName: 'Branch', role: 'cashier' },
    ]);
  });

  it('rejects inactive, malformed, and unknown-role rows', () => {
    expect(parseMembershipRows([
      { role: 'owner', active: false, stores: { id: 'one', name: 'Main' } },
      { role: 'superuser', active: true, stores: { id: 'two', name: 'Branch' } },
      null,
    ])).toEqual([]);
  });
});