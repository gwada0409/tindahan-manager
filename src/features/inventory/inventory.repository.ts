import { db } from '@/db/database';
import { InventoryBatch, Product } from '@/types';

export class InventoryRepository {
  /**
   * Calculates total available stock for a product from active batches.
   */
  async getAvailableStock(productId: string): Promise<number> {
    const batches = await db.inventoryBatches
      .where('productId')
      .equals(productId)
      .toArray();
      
    return batches.reduce((sum, b) => sum + (b.remainingQuantity > 0 ? b.remainingQuantity : 0), 0);
  }

  /**
   * Gets active batches for a product, sorted by expiration date (FEFO) or restock date (FIFO).
   */
  async getActiveBatches(productId: string): Promise<InventoryBatch[]> {
    const batches = await db.inventoryBatches
      .where('productId')
      .equals(productId)
      .toArray();

    return batches
      .filter(b => b.remainingQuantity > 0)
      .sort((a, b) => {
        // FEFO: if both have expiration dates, sort by earliest expiration
        if (a.expirationDate && b.expirationDate) {
          return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
        }
        // If one has expiration date, prioritize it over the one without
        if (a.expirationDate) return -1;
        if (b.expirationDate) return 1;
        
        // FIFO: fallback to earliest restock date
        return new Date(a.restockDate).getTime() - new Date(b.restockDate).getTime();
      });
  }

  /**
   * Update batches directly. Used within a Dexie transaction.
   */
  async updateBatches(batches: InventoryBatch[]): Promise<void> {
    await db.inventoryBatches.bulkPut(batches);
  }

  /**
   * Searches products by name, sku, or barcode efficiently.
   */
  async searchProducts(term: string, limit = 50): Promise<Product[]> {
    if (!term) return await db.products.limit(limit).toArray();
    const lowerTerm = term.toLowerCase();
    return await db.products.filter(p => 
      p.name.toLowerCase().includes(lowerTerm) || 
      p.sku.toLowerCase().includes(lowerTerm) ||
      p.barcode.includes(term)
    ).limit(limit).toArray();
  }
}

export const inventoryRepo = new InventoryRepository();
