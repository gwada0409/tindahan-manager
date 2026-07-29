import { Transaction } from 'dexie';

/**
 * Perform database migrations between versions.
 * 
 * Version 1 -> Version 2:
 * We added compound indexes to many tables to support scalable `.where().equals()` queries.
 * Dexie automatically creates these indexes on upgrade; no manual data transformation is required for V1 to V2
 * because the underlying data shape did not change, only the indexes did.
 */
export async function migrateV1toV2(tx: Transaction) {
  // Dexie automatically handles creating the new indexes defined in the schema.
  // We can use this space for any necessary data normalization if the shape had changed.
  console.log('Migrating database from V1 to V2: Building new indexes...');
}

export async function migrateV2toV3(tx: Transaction) {
  console.log('Migrating database from V2 to V3: Adding UserProfiles and store branding defaults...');
  const storeTable = tx.table('storeSettings');
  const stores = await storeTable.toArray();
  for (const store of stores) {
    let updated = false;
    if (!store.applicationName) {
      store.applicationName = 'Tindahan Manager';
      updated = true;
    }
    if (!store.themePrimaryColor) {
      store.themePrimaryColor = '#15803D';
      updated = true;
    }
    if (!store.themeAccentColor) {
      store.themeAccentColor = '#0369A1';
      updated = true;
    }
    if (updated) {
      await storeTable.put(store);
    }
  }
}
