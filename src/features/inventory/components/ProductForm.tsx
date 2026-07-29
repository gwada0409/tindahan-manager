import React from 'react';
import { Product } from '@/types';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface ProductFormProps {
  initialData?: Product | null;
  scannedBarcode?: string;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
  submitLabel?: string;
}

export function ProductForm({ initialData, scannedBarcode, onSubmit, onCancel, submitLabel = 'Save Product' }: ProductFormProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(new FormData(e.currentTarget));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Name</label>
        <Input name="name" required placeholder="e.g. Coca-Cola 1.5L" defaultValue={initialData?.name} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">SKU</label>
          <Input name="sku" required placeholder="SKU-123" defaultValue={initialData?.sku} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Barcode</label>
          <Input name="barcode" defaultValue={initialData?.barcode || scannedBarcode} placeholder="Optional" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Unit</label>
          <Input name="unit" required placeholder="e.g. piece, pack" defaultValue={initialData?.unit} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Reorder Level</label>
          <Input name="reorderLevel" type="number" required defaultValue={initialData?.reorderLevel || 5} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Cost Price (₱)</label>
          <Input name="costPrice" type="number" step="0.01" required placeholder="0.00" defaultValue={initialData ? (initialData.costPrice / 100).toFixed(2) : undefined} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Selling Price (₱)</label>
          <Input name="sellingPrice" type="number" step="0.01" required placeholder="0.00" defaultValue={initialData ? (initialData.sellingPrice / 100).toFixed(2) : undefined} />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <Input name="description" placeholder="Optional notes" defaultValue={initialData?.description} />
      </div>
      <div className="pt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
