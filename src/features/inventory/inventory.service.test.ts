import { describe, it, expect } from 'vitest';
import { InventoryService } from './inventory.service';
import { InventoryBatch } from '@/types';

describe('InventoryService', () => {
  const service = new InventoryService();

  const createBatch = (id: string, qty: number): InventoryBatch => ({
    id,
    productId: 'p1',
    quantityReceived: qty,
    remainingQuantity: qty,
    unitCost: 1000,
    restockDate: new Date(),
    referenceNumber: '',
    notes: ''
  });

  it('allocates stock correctly across multiple batches', () => {
    const batches = [createBatch('b1', 5), createBatch('b2', 10)];
    const { updatedBatches } = service.allocateStock(batches, 12, false);
    
    expect(updatedBatches[0].remainingQuantity).toBe(0);
    expect(updatedBatches[1].remainingQuantity).toBe(3);
  });

  it('throws INSUFFICIENT_STOCK if stock is low and negative is not allowed', () => {
    const batches = [createBatch('b1', 5)];
    expect(() => service.allocateStock(batches, 10, false)).toThrow('Insufficient stock');
  });

  it('allows negative inventory if explicitly permitted', () => {
    const batches = [createBatch('b1', 5)];
    const { updatedBatches } = service.allocateStock(batches, 10, true);
    
    // It should deduct from the batch
    expect(updatedBatches[0].remainingQuantity).toBe(-5);
  });
});
