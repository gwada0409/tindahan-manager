import { db } from '@/db/database';
import { inventoryService } from '@/features/inventory/inventory.service';
import { generateId } from '@/shared/utils/id';
import { AppError } from '@/shared/errors/AppError';
import { CartItem } from '@/store/cartStore';

export interface CheckoutRequest {
  items: CartItem[];
  paymentMethod: 'cash' | 'gcash' | 'utang';
  amountPaid: number;
  customerId?: string;
  gcashReference?: string;
}

export class CheckoutService {
  async processCheckout(request: CheckoutRequest): Promise<string> {
    if (request.items.length === 0) {
      throw new AppError('Cart is empty', 'EMPTY_CART');
    }

    const totalAmount = request.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (request.paymentMethod !== 'utang' && request.amountPaid < totalAmount) {
      throw new AppError('Insufficient payment amount', 'INSUFFICIENT_PAYMENT');
    }

    if (request.paymentMethod === 'utang' && !request.customerId) {
      throw new AppError('Customer is required for Utang', 'MISSING_CUSTOMER');
    }

    // Atomic transaction across all affected tables
    return await db.transaction(
      'rw',
      [
        db.sales,
        db.saleItems,
        db.inventoryBatches,
        db.products,
        db.customers,
        db.utangEntries,
        db.gcashTransactions,
        db.storeSettings
      ],
      async () => {
        const storeSettings = await db.storeSettings.toCollection().first();
        const allowNegative = storeSettings?.allowNegativeInventory ?? false;
        const now = new Date();
        const saleId = generateId();

        // 1. Process Inventory
        for (const item of request.items) {
          const product = await db.products.get(item.id);
          if (!product) {
            throw new AppError(`Product not found: ${item.name}`, 'PRODUCT_NOT_FOUND');
          }

          // We only allocate stock if it's a physical product. Assuming all cart items are physical for now unless specified
          const batches = await db.inventoryBatches
            .where('productId')
            .equals(item.id)
            .toArray();

          const sortedBatches = batches.sort((a, b) => {
             if (a.expirationDate && b.expirationDate) return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
             if (a.expirationDate) return -1;
             if (b.expirationDate) return 1;
             return new Date(a.restockDate).getTime() - new Date(b.restockDate).getTime();
          });

          const { updatedBatches } = inventoryService.allocateStock(sortedBatches, item.quantity, allowNegative);

          // Save the modified batches
          await db.inventoryBatches.bulkPut(updatedBatches);
          
          // Create SaleItem
          await db.saleItems.add({
            id: generateId(),
            saleId,
            itemId: item.id,
            itemType: 'product',
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            discount: 0,
            total: item.price * item.quantity
          });
        }

        // 2. Create Sale Record
        await db.sales.add({
          id: saleId,
          date: now,
          subtotal: totalAmount,
          discount: 0,
          total: totalAmount,
          paymentMethod: request.paymentMethod,
          amountReceived: request.paymentMethod === 'utang' ? 0 : request.amountPaid,
          changeAmount: request.paymentMethod === 'cash' ? Math.max(0, request.amountPaid - totalAmount) : undefined,
          status: 'completed',
          customerId: request.customerId,
          referenceNumber: request.gcashReference
        });

        // 3. Handle Utang
        if (request.paymentMethod === 'utang' && request.customerId) {
          const customer = await db.customers.get(request.customerId);
          if (!customer) throw new AppError('Customer not found', 'CUSTOMER_NOT_FOUND');
          
          // Check credit limit (simple implementation: we just warn or block)
          // In a real app we'd sum their unpaid utang, but per the specs we just record it.
          await db.utangEntries.add({
            id: generateId(),
            customerId: request.customerId,
            amount: totalAmount,
            date: now,
            type: 'charge',
            referenceId: saleId,
            notes: `Purchase #${saleId.substring(0,8)}`
          });
        }

        // 4. Handle GCash
        if (request.paymentMethod === 'gcash') {
          await db.gcashTransactions.add({
            id: generateId(),
            type: 'sale',
            amount: totalAmount,
            serviceFee: 0,
            date: now,
            referenceNumber: request.gcashReference || '',
            customerId: request.customerId,
            notes: 'Sale transaction'
          });
        }

        return saleId;
      }
    );
  }
}

export const checkoutService = new CheckoutService();
