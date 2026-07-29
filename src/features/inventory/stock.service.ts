import { db } from '@/db/database';
import { InventoryBatch, Product, ProductStockSummary, StockStatus } from '@/types';

export class StockService {
  /**
   * Calculates ProductStockSummary for a given product and its inventory batches according to domain rules.
   */
  calculateProductStockSummary(product: Product, batches: InventoryBatch[]): ProductStockSummary {
    const productBatches = batches.filter(b => b.productId === product.id);
    
    const availableQuantity = productBatches.reduce(
      (sum, b) => sum + Math.max(0, b.remainingQuantity),
      0
    );
    const reservedQuantity = 0;
    const sellableQuantity = availableQuantity;
    const reorderLevel = product.reorderLevel || 0;

    let status: StockStatus;

    if (sellableQuantity <= 0) {
      status = 'out-of-stock';
    } else if (
      reorderLevel > 0 &&
      sellableQuantity <= Math.max(1, Math.floor(reorderLevel / 2))
    ) {
      status = 'critical';
    } else if (reorderLevel > 0 && sellableQuantity <= reorderLevel) {
      status = 'low-stock';
    } else {
      status = 'in-stock';
    }

    // Find nearest expiration date among batches with remaining quantity
    const expDates = productBatches
      .filter(b => b.remainingQuantity > 0 && b.expirationDate)
      .map(b => new Date(b.expirationDate!).getTime())
      .sort((a, b) => a - b);

    const nextExpirationDate = expDates.length > 0 ? new Date(expDates[0]) : undefined;

    return {
      productId: product.id,
      availableQuantity,
      reservedQuantity,
      sellableQuantity,
      reorderLevel,
      status,
      nextExpirationDate
    };
  }

  /**
   * Efficiently retrieves stock summaries for a list of products in bulk.
   * Avoids the N+1 query problem by batch-fetching all relevant inventory batches.
   */
  async getProductsStockSummaries(products: Product[]): Promise<Map<string, ProductStockSummary>> {
    const map = new Map<string, ProductStockSummary>();
    if (!products || products.length === 0) return map;

    const productIds = products.map(p => p.id);
    
    // Fetch all active/relevant batches in one indexed query
    const batches = await db.inventoryBatches
      .where('productId')
      .anyOf(productIds)
      .toArray();

    const batchesByProduct = new Map<string, InventoryBatch[]>();
    for (const batch of batches) {
      if (!batchesByProduct.has(batch.productId)) {
        batchesByProduct.set(batch.productId, []);
      }
      batchesByProduct.get(batch.productId)!.push(batch);
    }

    for (const product of products) {
      const pBatches = batchesByProduct.get(product.id) || [];
      map.set(product.id, this.calculateProductStockSummary(product, pBatches));
    }

    return map;
  }

  /**
   * Retrieves stock summary for a single product.
   */
  async getProductStockSummary(product: Product): Promise<ProductStockSummary> {
    const batches = await db.inventoryBatches
      .where('productId')
      .equals(product.id)
      .toArray();

    return this.calculateProductStockSummary(product, batches);
  }
}

export const stockService = new StockService();
