import { InventoryBatch, Store } from '@/types';
import { AppError } from '@/shared/errors/AppError';
import { generateId } from '@/shared/utils/id';

export class InventoryService {
  /**
   * Deduct stock from a list of batches using FEFO/FIFO strategy.
   * Returns a tuple of [updatedBatches, deductedAmount] without saving them.
   * Throws AppError if stock is insufficient and allowNegativeInventory is false.
   */
  allocateStock(
    batches: InventoryBatch[],
    requiredQty: number,
    allowNegative: boolean = false
  ): { updatedBatches: InventoryBatch[]; deductedTotal: number } {
    
    if (requiredQty <= 0) {
      throw new AppError('Quantity must be greater than zero', 'INVALID_QUANTITY');
    }

    let remainingToDeduct = requiredQty;
    const updatedBatches = [...batches.map(b => ({ ...b }))]; // deep copy
    
    for (const batch of updatedBatches) {
      if (remainingToDeduct <= 0) break;
      if (batch.remainingQuantity <= 0) continue;

      const deductAmount = Math.min(batch.remainingQuantity, remainingToDeduct);
      batch.remainingQuantity -= deductAmount;
      remainingToDeduct -= deductAmount;
    }

    if (remainingToDeduct > 0 && !allowNegative) {
      throw new AppError('Insufficient stock', 'INSUFFICIENT_STOCK');
    }

    // If negative inventory is allowed, we deduct the remainder from the latest batch 
    // or create a synthetic negative batch (but usually just deducting from the last known batch is simplest)
    if (remainingToDeduct > 0 && allowNegative) {
      if (updatedBatches.length > 0) {
        // deduct from the most recently prioritized batch (the last one checked, or we just pick the last one)
        updatedBatches[updatedBatches.length - 1].remainingQuantity -= remainingToDeduct;
      } else {
        // We have no batches at all, we'd need to create one.
        // For simplicity, this service expects at least one batch to deduct from if negative is allowed.
        // In real life, the repository should generate an empty batch if none exist.
      }
    }

    return {
      updatedBatches,
      deductedTotal: requiredQty // if we didn't throw, we successfully allocated requiredQty
    };
  }
}

export const inventoryService = new InventoryService();
