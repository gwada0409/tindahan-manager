import { db } from './database';
import { generateId } from '@/shared/utils/id';
import { createSyncMetadata } from '@/domain/sync/syncMetadata';
import { getOrCreateDeviceId } from '@/services/device/deviceIdentityService';

/**
 * Seeds the database with development/demo data.
 * The entire operation runs inside a single atomic transaction.
 * To make it idempotent without relying only on store settings, we clear existing seed data first or use explicit IDs.
 */
export async function seedDatabase() {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('Seeding is restricted to development mode only.');
    return;
  }

  try {
    await db.transaction('rw', db.storeSettings, db.categories, db.products, db.customers, async () => {
      // Check if already seeded via a specific demo setting
      const existingStore = await db.storeSettings.get('store-demo-1');
      if (existingStore) {
        console.log('Demo database already seeded.');
        return;
      }

      console.log('Seeding demo database inside an atomic transaction...');
      const sync = () => createSyncMetadata({
        storeId: 'store-demo-1',
        deviceId: getOrCreateDeviceId(),
      });

      // Seed Store Settings
      await db.storeSettings.put({
        id: 'store-demo-1',
        name: 'Tindahan Demo Store',
        ownerName: 'Juan Dela Cruz',
        address: '123 Barangay San Isidro, Manila',
        contact: '0917-123-4567',
        currency: 'PHP',
        timezone: 'Asia/Manila',
        expirationWarningDays: 30,
        allowNegativeInventory: false,
        themePreference: 'light',
        sync: sync(),
      });

      // Seed Categories
      const catDrinks = 'cat-drinks-demo';
      const catSnacks = 'cat-snacks-demo';
      const catCanned = 'cat-canned-demo';
      await db.categories.bulkPut([
        { id: catDrinks, name: 'Beverages', sync: sync() },
        { id: catSnacks, name: 'Snacks', sync: sync() },
        { id: catCanned, name: 'Canned Goods', sync: sync() }
      ]);

      // Seed Products
      await db.products.bulkPut([
        {
          id: generateId(),
          name: 'Coca-Cola 1.5L',
          sku: 'COKE-15L-DEMO',
          barcode: '4800361320499',
          categoryId: catDrinks,
          unit: 'bottle',
          costPrice: 6500, // 65.00
          sellingPrice: 8500, // 85.00
          reorderLevel: 10,
          description: 'Classic Coca Cola',
          active: true,
          sync: sync(),
        },
        {
          id: generateId(),
          name: 'Piattos Cheese 85g',
          sku: 'PIAT-CHZ-DEMO',
          barcode: '4800361320500',
          categoryId: catSnacks,
          unit: 'pack',
          costPrice: 2000,
          sellingPrice: 2800,
          reorderLevel: 20,
          description: 'Cheese flavored potato crisps',
          active: true,
          sync: sync(),
        },
        {
          id: generateId(),
          name: 'Century Tuna Flakes in Oil',
          sku: 'CENT-TUNA-DEMO',
          barcode: '4800361320501',
          categoryId: catCanned,
          unit: 'can',
          costPrice: 3500,
          sellingPrice: 4500,
          reorderLevel: 15,
          description: 'Tuna flakes',
          active: true,
          sync: sync(),
        }
      ]);

      // Seed Customers
      await db.customers.bulkPut([
        {
          id: 'cust-demo-1',
          fullName: 'Maria Clara',
          phoneNumber: '0918-111-2222',
          address: 'San Diego',
          creditLimit: 200000,
          notes: 'Trusted customer',
          active: true,
          sync: sync(),
          createdAt: new Date()
        },
        {
          id: 'cust-demo-2',
          fullName: 'Crisostomo Ibarra',
          phoneNumber: '0919-333-4444',
          address: 'Manila',
          creditLimit: 500000,
          notes: '',
          active: true,
          sync: sync(),
          createdAt: new Date()
        }
      ]);
      
      console.log('Seeding complete!');
    });
  } catch (error) {
    console.error('Seeding transaction failed and rolled back:', error);
  }
}
