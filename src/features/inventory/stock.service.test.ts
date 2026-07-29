import { describe, it, expect } from 'vitest';
import { stockService } from './stock.service';
import { Product, InventoryBatch } from '@/types';
import { formatUnit } from './components/StockIndicator';

describe('StockService & Stock Indicator', () => {
  const dummyProduct: Product = {
    id: 'p1',
    name: 'Test Coffee',
    sku: 'COF-01',
    barcode: '12345678',
    categoryId: 'c1',
    unit: 'pack',
    costPrice: 5000,
    sellingPrice: 8000,
    reorderLevel: 10,
    description: '',
    active: true
  };

  it('aggregates stock across multiple batches and handles zero/negative remaining quantities safely', () => {
    const batches: InventoryBatch[] = [
      {
        id: 'b1',
        productId: 'p1',
        quantityReceived: 50,
        remainingQuantity: 20,
        unitCost: 5000,
        restockDate: new Date(),
        referenceNumber: 'REF1',
        notes: ''
      },
      {
        id: 'b2',
        productId: 'p1',
        quantityReceived: 30,
        remainingQuantity: 0,
        unitCost: 5000,
        restockDate: new Date(),
        referenceNumber: 'REF2',
        notes: ''
      },
      {
        id: 'b3',
        productId: 'p1',
        quantityReceived: 10,
        remainingQuantity: -5, // Protection against negative
        unitCost: 5000,
        restockDate: new Date(),
        referenceNumber: 'REF3',
        notes: ''
      }
    ];

    const summary = stockService.calculateProductStockSummary(dummyProduct, batches);
    expect(summary.availableQuantity).toBe(20);
    expect(summary.sellableQuantity).toBe(20);
    expect(summary.status).toBe('in-stock'); // 20 > reorderLevel 10
  });

  it('correctly classifies out-of-stock when sellableQuantity <= 0', () => {
    const summary = stockService.calculateProductStockSummary(dummyProduct, []);
    expect(summary.availableQuantity).toBe(0);
    expect(summary.status).toBe('out-of-stock');
  });

  it('correctly classifies critical stock when sellableQuantity <= Math.floor(reorderLevel / 2)', () => {
    // reorderLevel = 10, floor(10/2) = 5
    const batches: InventoryBatch[] = [
      {
        id: 'b1',
        productId: 'p1',
        quantityReceived: 10,
        remainingQuantity: 4,
        unitCost: 5000,
        restockDate: new Date(),
        referenceNumber: 'REF1',
        notes: ''
      }
    ];

    const summary = stockService.calculateProductStockSummary(dummyProduct, batches);
    expect(summary.status).toBe('critical');
  });

  it('correctly classifies low-stock when sellableQuantity <= reorderLevel but > critical threshold', () => {
    // reorderLevel = 10, critical threshold = 5. So 7 is low-stock.
    const batches: InventoryBatch[] = [
      {
        id: 'b1',
        productId: 'p1',
        quantityReceived: 10,
        remainingQuantity: 7,
        unitCost: 5000,
        restockDate: new Date(),
        referenceNumber: 'REF1',
        notes: ''
      }
    ];

    const summary = stockService.calculateProductStockSummary(dummyProduct, batches);
    expect(summary.status).toBe('low-stock');
  });

  it('handles reorderLevel === 0 explicitly without classifying positive quantity as low-stock', () => {
    const prodNoReorder: Product = {
      ...dummyProduct,
      reorderLevel: 0
    };

    const outSummary = stockService.calculateProductStockSummary(prodNoReorder, []);
    expect(outSummary.status).toBe('out-of-stock');

    const inSummary = stockService.calculateProductStockSummary(prodNoReorder, [
      {
        id: 'b1',
        productId: 'p1',
        quantityReceived: 10,
        remainingQuantity: 1,
        unitCost: 5000,
        restockDate: new Date(),
        referenceNumber: 'REF1',
        notes: ''
      }
    ]);
    expect(inSummary.status).toBe('in-stock');
  });

  it('formats singular and plural quantity labels correctly', () => {
    expect(formatUnit(1, 'bottle')).toBe('1 bottle left');
    expect(formatUnit(2, 'bottle')).toBe('2 bottles left');
    expect(formatUnit(1, 'pack')).toBe('1 pack left');
    expect(formatUnit(5, 'pack')).toBe('5 packs left');
    expect(formatUnit(0, 'piece')).toBe('0 pcs left');
  });
});
