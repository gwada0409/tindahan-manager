import React from 'react';
import { Product, ProductStockSummary } from '@/types';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { StockIndicator } from './StockIndicator';
import { PlusCircle, Edit3, Trash2, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface ProductListProps {
  products?: Product[];
  stockSummaries: Map<string, ProductStockSummary>;
  onRestock: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
  hasDeletePermission?: boolean;
}

export function ProductList({
  products,
  stockSummaries,
  onRestock,
  onEdit,
  onDelete,
  hasDeletePermission = true
}: ProductListProps) {
  if (!products || products.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-border p-12 text-center text-muted-foreground shadow-sm">
        No products found matching your current filter. Add a product or adjust your filters.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mobile Card View (hidden on md and above) */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {products.map((product) => {
          const stock = stockSummaries.get(product.id) || {
            productId: product.id,
            availableQuantity: 0,
            reservedQuantity: 0,
            sellableQuantity: 0,
            reorderLevel: product.reorderLevel || 0,
            status: 'out-of-stock' as const
          };

          return (
            <div key={product.id} className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-foreground text-base">{product.name}</h3>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">
                    SKU: {product.sku} {product.barcode ? `· Barcode: ${product.barcode}` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-primary tabular-nums">
                    ₱{(product.sellingPrice / 100).toFixed(2)}
                  </div>
                  <div className="text-[11px] text-muted-foreground capitalize">per {product.unit || 'piece'}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
                <StockIndicator
                  quantity={stock.sellableQuantity}
                  reorderLevel={stock.reorderLevel}
                  status={stock.status}
                  unit={product.unit}
                  compact
                />
                
                {stock.nextExpirationDate && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    <Calendar className="w-3 h-3" />
                    Exp: {format(new Date(stock.nextExpirationDate), 'MMM d, yyyy')}
                  </span>
                )}
              </div>

              <div className="flex justify-end items-center gap-2 pt-2 border-t border-border/50">
                <Button variant="outline" size="sm" onClick={() => onRestock(product)} className="h-9 px-3 text-xs">
                  <PlusCircle className="w-3.5 h-3.5 mr-1" /> Restock
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onEdit(product)} className="h-9 px-2 text-xs">
                  <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
                {hasDeletePermission && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => onDelete(product.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table View (hidden on small screens) */}
      <div className="hidden md:block bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>SKU / Barcode</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Selling Price</TableHead>
              <TableHead className="text-center">Stock Status</TableHead>
              <TableHead className="text-center">Earliest Expiration</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => {
              const stock = stockSummaries.get(product.id) || {
                productId: product.id,
                availableQuantity: 0,
                reservedQuantity: 0,
                sellableQuantity: 0,
                reorderLevel: product.reorderLevel || 0,
                status: 'out-of-stock' as const
              };

              return (
                <TableRow key={product.id}>
                  <TableCell className="font-semibold text-foreground">{product.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    <div>{product.sku}</div>
                    {product.barcode && <div className="text-[11px] text-muted-foreground">{product.barcode}</div>}
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">{product.categoryId || 'General'}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    ₱{(product.sellingPrice / 100).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    <StockIndicator
                      quantity={stock.sellableQuantity}
                      reorderLevel={stock.reorderLevel}
                      status={stock.status}
                      unit={product.unit}
                      compact
                    />
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {stock.nextExpirationDate ? (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        {format(new Date(stock.nextExpirationDate), 'MMM d, yyyy')}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="outline" size="sm" onClick={() => onRestock(product)} title="Add stock batch">
                      <PlusCircle className="w-3.5 h-3.5 mr-1" /> Restock
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onEdit(product)}>
                      Edit
                    </Button>
                    {hasDeletePermission && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onDelete(product.id)}
                      >
                        Delete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
