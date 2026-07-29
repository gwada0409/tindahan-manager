import React, { useState } from 'react';
import { Product } from '@/types';
import { db } from '@/db/database';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { generateId } from '@/shared/utils/id';

export interface RestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onRestockComplete?: () => void;
}

export function RestockModal({ isOpen, onClose, product, onRestockComplete }: RestockModalProps) {
  const { showToast } = useToast();
  const [quantityReceived, setQuantityReceived] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantityReceived, 10);
    const cost = Math.round(parseFloat(unitCost || '0') * 100);

    if (isNaN(qty) || qty <= 0) {
      showToast('Quantity received must be a positive integer', 'error');
      return;
    }

    if (isNaN(cost) || cost < 0) {
      showToast('Unit cost must be a valid nonnegative amount', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const batchId = generateId();
      const movementId = generateId();
      const now = new Date();

      await db.transaction('rw', [db.inventoryBatches, db.stockMovements, db.auditLogs], async () => {
        // Create Inventory Batch
        await db.inventoryBatches.add({
          id: batchId,
          productId: product.id,
          quantityReceived: qty,
          remainingQuantity: qty,
          unitCost: cost,
          restockDate: now,
          expirationDate: expirationDate ? new Date(expirationDate) : undefined,
          supplierId: product.supplierId,
          referenceNumber: referenceNumber || `RESTOCK-${Date.now().toString().slice(-6)}`,
          notes
        });

        // Create Stock Movement
        await db.stockMovements.add({
          id: movementId,
          productId: product.id,
          batchId,
          type: 'restock',
          quantity: qty,
          date: now,
          referenceId: batchId,
          notes: `Restocked ${qty} ${product.unit || 'units'}. Ref: ${referenceNumber || 'N/A'}`
        });

        // Log Audit Event
        await db.auditLogs.add({
          id: generateId(),
          date: now,
          action: 'inventory:restock',
          entityType: 'product',
          entityId: product.id,
          details: JSON.stringify({ productName: product.name, qty, unitCost: cost })
        });
      });

      showToast(`Added ${qty} ${product.unit || 'units'} to ${product.name}!`, 'success');
      setQuantityReceived('');
      setUnitCost('');
      setExpirationDate('');
      setReferenceNumber('');
      setNotes('');
      onClose();
      if (onRestockComplete) onRestockComplete();
    } catch (err: any) {
      console.error(err);
      showToast('Failed to add stock batch', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Add Stock / Restock - ${product.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-muted/50 p-3 rounded-lg text-sm grid grid-cols-2 gap-2">
          <div><span className="text-muted-foreground">SKU:</span> <span className="font-medium">{product.sku}</span></div>
          <div><span className="text-muted-foreground">Unit:</span> <span className="font-medium capitalize">{product.unit || 'piece'}</span></div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Quantity Received *</label>
            <Input
              type="number"
              min="1"
              required
              autoFocus
              value={quantityReceived}
              onChange={e => setQuantityReceived(e.target.value)}
              placeholder="e.g. 50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Unit Cost (₱) *</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              required
              value={unitCost}
              onChange={e => setUnitCost(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Expiration Date (Optional)</label>
            <Input
              type="date"
              value={expirationDate}
              onChange={e => setExpirationDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Ref / PO Number</label>
            <Input
              value={referenceNumber}
              onChange={e => setReferenceNumber(e.target.value)}
              placeholder="e.g. PO-1092"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Notes</label>
          <Input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional supplier/batch notes"
          />
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving Stock...' : 'Confirm Restock'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
