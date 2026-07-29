import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { Product, StockStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Card, CardContent } from '@/components/ui/Card';
import { Plus, Search, ScanLine, AlertOctagon, AlertTriangle, AlertCircle, CheckCircle2, Calendar } from 'lucide-react';
import { BarcodeScannerModal } from '@/components/ui/BarcodeScannerModal';
import { productRepo } from '@/repositories/ProductRepository';
import { useToast } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ProductList } from '@/features/inventory/components/ProductList';
import { ProductForm } from '@/features/inventory/components/ProductForm';
import { RestockModal } from '@/features/inventory/components/RestockModal';
import { stockService } from '@/features/inventory/stock.service';

type SortOption = 'lowest-qty' | 'highest-qty' | 'name' | 'nearest-expiration' | 'reorder-priority';
type StockFilter = 'all' | 'out-of-stock' | 'critical' | 'low-stock' | 'in-stock' | 'expiring-soon';

export function Inventory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('reorder-priority');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const { showToast } = useToast();

  const products = useLiveQuery(() => db.products.toArray(), []) || [];
  const inventoryBatches = useLiveQuery(() => db.inventoryBatches.toArray(), []) || [];

  // Reactive bulk stock calculation
  const stockSummaries = React.useMemo(() => {
    const map = new Map<string, ReturnType<typeof stockService.calculateProductStockSummary>>();
    for (const product of products) {
      map.set(product.id, stockService.calculateProductStockSummary(product, inventoryBatches));
    }
    return map;
  }, [products, inventoryBatches]);

  // Aggregate metric counts for summary cards
  const metrics = React.useMemo(() => {
    let outOfStock = 0;
    let critical = 0;
    let lowStock = 0;
    let expiringSoon = 0;
    const now = new Date().getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    stockSummaries.forEach((summary) => {
      if (summary.status === 'out-of-stock') outOfStock++;
      else if (summary.status === 'critical') critical++;
      else if (summary.status === 'low-stock') lowStock++;

      if (summary.nextExpirationDate) {
        const diff = summary.nextExpirationDate.getTime() - now;
        if (diff > 0 && diff <= thirtyDays) {
          expiringSoon++;
        }
      }
    });

    return {
      total: products.length,
      outOfStock,
      critical,
      lowStock,
      expiringSoon
    };
  }, [products, stockSummaries]);

  // Search & Filter
  const filteredProducts = React.useMemo(() => {
    return products.filter((p) => {
      const summary = stockSummaries.get(p.id);

      // Search term filter
      const matchesSearch =
        !searchTerm ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.barcode.includes(searchTerm);

      if (!matchesSearch) return false;

      // Stock status filter
      if (stockFilter === 'all') return true;
      if (stockFilter === 'out-of-stock') return summary?.status === 'out-of-stock';
      if (stockFilter === 'critical') return summary?.status === 'critical';
      if (stockFilter === 'low-stock') return summary?.status === 'low-stock';
      if (stockFilter === 'in-stock') return summary?.status === 'in-stock';
      if (stockFilter === 'expiring-soon') {
        if (!summary?.nextExpirationDate) return false;
        const diff = summary.nextExpirationDate.getTime() - new Date().getTime();
        return diff > 0 && diff <= 30 * 24 * 60 * 60 * 1000;
      }

      return true;
    });
  }, [products, stockSummaries, searchTerm, stockFilter]);

  // Sorting logic
  const sortedProducts = React.useMemo(() => {
    const list = [...filteredProducts];
    list.sort((a, b) => {
      const sumA = stockSummaries.get(a.id);
      const sumB = stockSummaries.get(b.id);
      const qtyA = sumA?.sellableQuantity || 0;
      const qtyB = sumB?.sellableQuantity || 0;

      if (sortOption === 'lowest-qty') {
        return qtyA - qtyB;
      }
      if (sortOption === 'highest-qty') {
        return qtyB - qtyA;
      }
      if (sortOption === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortOption === 'nearest-expiration') {
        const expA = sumA?.nextExpirationDate ? sumA.nextExpirationDate.getTime() : Infinity;
        const expB = sumB?.nextExpirationDate ? sumB.nextExpirationDate.getTime() : Infinity;
        return expA - expB;
      }
      if (sortOption === 'reorder-priority') {
        const priorityScore = (status?: StockStatus) => {
          if (status === 'out-of-stock') return 1;
          if (status === 'critical') return 2;
          if (status === 'low-stock') return 3;
          return 4;
        };
        const pA = priorityScore(sumA?.status);
        const pB = priorityScore(sumB?.status);
        if (pA !== pB) return pA - pB;
        return qtyA - qtyB;
      }
      return 0;
    });
    return list;
  }, [filteredProducts, stockSummaries, sortOption]);

  const handleAddProduct = async (formData: FormData) => {
    await productRepo.add({
      name: formData.get('name') as string,
      sku: formData.get('sku') as string,
      barcode: formData.get('barcode') as string,
      categoryId: (formData.get('categoryId') as string) || 'default',
      unit: formData.get('unit') as string,
      costPrice: Math.round(parseFloat(formData.get('costPrice') as string) * 100),
      sellingPrice: Math.round(parseFloat(formData.get('sellingPrice') as string) * 100),
      reorderLevel: parseInt(formData.get('reorderLevel') as string, 10),
      description: formData.get('description') as string,
      active: true
    });
    setIsAddModalOpen(false);
    setScannedBarcode('');
    showToast('Product added successfully!');
  };

  const handleEditProduct = async (formData: FormData) => {
    if (!editingProduct) return;
    await productRepo.update(editingProduct.id, {
      name: formData.get('name') as string,
      sku: formData.get('sku') as string,
      barcode: formData.get('barcode') as string,
      unit: formData.get('unit') as string,
      costPrice: Math.round(parseFloat(formData.get('costPrice') as string) * 100),
      sellingPrice: Math.round(parseFloat(formData.get('sellingPrice') as string) * 100),
      reorderLevel: parseInt(formData.get('reorderLevel') as string, 10),
      description: formData.get('description') as string
    });
    setIsEditModalOpen(false);
    setEditingProduct(null);
    showToast('Product updated successfully!');
  };

  const handleDeleteConfirm = async () => {
    if (deletingProductId) {
      if (productRepo.delete) {
        await productRepo.delete(deletingProductId);
      } else {
        await db.products.delete(deletingProductId);
      }
      showToast('Product deleted!');
      setDeletingProductId(null);
    }
  };

  const handleScan = (decodedText: string) => {
    const existing = products.find((p) => p.barcode === decodedText || p.sku === decodedText);
    if (existing) {
      setSearchTerm(decodedText);
      showToast('Product found in inventory', 'success');
    } else {
      setScannedBarcode(decodedText);
      setIsAddModalOpen(true);
      showToast('New barcode detected. Add product details.', 'success');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card
          onClick={() => setStockFilter('all')}
          className={`cursor-pointer transition-all hover:shadow-md border ${
            stockFilter === 'all' ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : ''
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Total Products</div>
              <div className="text-2xl font-bold text-foreground tabular-nums">{metrics.total}</div>
            </div>
            <CheckCircle2 className="w-6 h-6 text-muted-foreground opacity-50" />
          </CardContent>
        </Card>

        <Card
          onClick={() => setStockFilter('out-of-stock')}
          className={`cursor-pointer transition-all hover:shadow-md border ${
            stockFilter === 'out-of-stock' ? 'border-destructive ring-2 ring-destructive/20 bg-destructive/5' : ''
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Out of Stock</div>
              <div className="text-2xl font-bold text-destructive tabular-nums">{metrics.outOfStock}</div>
            </div>
            <AlertOctagon className="w-6 h-6 text-destructive opacity-75" />
          </CardContent>
        </Card>

        <Card
          onClick={() => setStockFilter('critical')}
          className={`cursor-pointer transition-all hover:shadow-md border ${
            stockFilter === 'critical' ? 'border-red-500 ring-2 ring-red-500/20 bg-red-500/5' : ''
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Critical Stock</div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">{metrics.critical}</div>
            </div>
            <AlertTriangle className="w-6 h-6 text-red-500 opacity-75" />
          </CardContent>
        </Card>

        <Card
          onClick={() => setStockFilter('low-stock')}
          className={`cursor-pointer transition-all hover:shadow-md border ${
            stockFilter === 'low-stock' ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5' : ''
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Low Stock</div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{metrics.lowStock}</div>
            </div>
            <AlertCircle className="w-6 h-6 text-amber-500 opacity-75" />
          </CardContent>
        </Card>

        <Card
          onClick={() => setStockFilter('expiring-soon')}
          className={`cursor-pointer transition-all hover:shadow-md border col-span-2 sm:col-span-1 ${
            stockFilter === 'expiring-soon' ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/5' : ''
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Expiring Soon</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">{metrics.expiringSoon}</div>
            </div>
            <Calendar className="w-6 h-6 text-blue-500 opacity-75" />
          </CardContent>
        </Card>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products, SKU, or barcode..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => setIsScannerOpen(true)} title="Scan Barcode">
            <ScanLine className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Stock Filter Dropdown / Buttons */}
          <select
            aria-label="Filter by stock status"
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as StockFilter)}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">Filter: All Statuses</option>
            <option value="out-of-stock">Out of Stock</option>
            <option value="critical">Critical Stock</option>
            <option value="low-stock">Low Stock</option>
            <option value="in-stock">In Stock</option>
            <option value="expiring-soon">Expiring Soon</option>
          </select>

          {/* Sort Dropdown */}
          <select
            aria-label="Sort products"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="reorder-priority">Sort: Reorder Priority</option>
            <option value="lowest-qty">Sort: Quantity (Lowest)</option>
            <option value="highest-qty">Sort: Quantity (Highest)</option>
            <option value="name">Sort: Product Name</option>
            <option value="nearest-expiration">Sort: Nearest Expiration</option>
          </select>

          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Product
          </Button>
        </div>
      </div>

      {/* Product List */}
      <ProductList
        products={sortedProducts}
        stockSummaries={stockSummaries}
        onRestock={(product) => setRestockProduct(product)}
        onEdit={(product) => {
          setEditingProduct(product);
          setIsEditModalOpen(true);
        }}
        onDelete={(id) => setDeletingProductId(id)}
      />

      {/* Add Product Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setScannedBarcode('');
        }}
        title="Add New Product Record"
      >
        <ProductForm
          scannedBarcode={scannedBarcode}
          onSubmit={handleAddProduct}
          onCancel={() => {
            setIsAddModalOpen(false);
            setScannedBarcode('');
          }}
          submitLabel="Save Product Record"
        />
      </Modal>

      {/* Edit Product Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingProduct(null);
        }}
        title="Edit Product Details"
      >
        {editingProduct && (
          <ProductForm
            initialData={editingProduct}
            onSubmit={handleEditProduct}
            onCancel={() => {
              setIsEditModalOpen(false);
              setEditingProduct(null);
            }}
            submitLabel="Save Changes"
          />
        )}
      </Modal>

      {/* Restock Modal */}
      <RestockModal
        isOpen={!!restockProduct}
        onClose={() => setRestockProduct(null)}
        product={restockProduct}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingProductId}
        onClose={() => setDeletingProductId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone."
      />

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScan}
      />
    </div>
  );
}
