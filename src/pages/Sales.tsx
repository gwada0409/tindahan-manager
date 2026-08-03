import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCartStore } from '@/store/cartStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Search, ScanLine, ShoppingCart, Trash2, Plus, Minus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Product } from '@/types';
import { useToast } from '@/components/ui/Toast';
import { BarcodeScannerModal } from '@/components/ui/BarcodeScannerModal';
import { checkoutService } from '@/features/sales/checkout.service';
import { inventoryRepo } from '@/features/inventory/inventory.repository';
import { stockService } from '@/features/inventory/stock.service';
import { StockIndicator } from '@/features/inventory/components/StockIndicator';
import { customerRepo } from '@/repositories/CustomerRepository';

export function Sales() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash' | 'utang'>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  
  const { items, addItem, updateQuantity, removeItem, getSubtotal, getTotal, discount, setDiscount, clearCart } = useCartStore();
  const { showToast } = useToast();

  const customers = useLiveQuery(() => customerRepo.list(), []) || [];
  const inventoryBatches = useLiveQuery(() => inventoryRepo.listBatches(), []) || [];
  
  const filteredProducts = useLiveQuery(
    () => inventoryRepo.searchProducts(searchTerm, 50),
    [searchTerm]
  ) || [];

  // Reactive stock summaries for visible products
  const stockSummaries = React.useMemo(() => {
    const map = new Map<string, ReturnType<typeof stockService.calculateProductStockSummary>>();
    for (const product of filteredProducts) {
      map.set(product.id, stockService.calculateProductStockSummary(product, inventoryBatches));
    }
    return map;
  }, [filteredProducts, inventoryBatches]);

  const handleProductClick = (product: Product) => {
    const stock = stockSummaries.get(product.id) || stockService.calculateProductStockSummary(product, inventoryBatches);
    
    if (stock.status === 'out-of-stock' || stock.sellableQuantity <= 0) {
      showToast(`${product.name} is out of stock`, 'error');
      return;
    }

    if (stock.status === 'critical' || stock.status === 'low-stock') {
      showToast(`Warning: Low stock for ${product.name} (${stock.sellableQuantity} left)`, 'warning');
    }

    addItem({
      id: product.id,
      type: 'product',
      name: product.name,
      price: product.sellingPrice,
      quantity: 1,
      maxQuantity: stock.sellableQuantity
    });
  };

  const handleScan = async (decodedText: string) => {
    setSearchTerm(decodedText);
    const results = await inventoryRepo.searchProducts(decodedText, 5);
    const exactMatch = results.filter(p => p.barcode === decodedText || p.sku === decodedText);
    
    if (exactMatch && exactMatch.length === 1) {
      const product = exactMatch[0];
      const stock = stockService.calculateProductStockSummary(product, inventoryBatches);
      
      if (stock.status === 'out-of-stock' || stock.sellableQuantity <= 0) {
        showToast(`Scanned product ${product.name} is out of stock!`, 'error');
      } else {
        handleProductClick(product);
        setSearchTerm('');
        showToast('Product added to cart', 'success');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredProducts && filteredProducts.length === 1) {
        handleProductClick(filteredProducts[0]);
        setSearchTerm('');
      }
    }
  };

  const subtotal = getSubtotal();
  const total = getTotal();
  const change = paymentMethod === 'cash' && amountReceived 
    ? Math.max(0, (parseFloat(amountReceived) * 100) - total) 
    : 0;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (paymentMethod === 'cash' && change < 0) return;
    if (paymentMethod === 'utang' && !customerId) return;

    try {
      await checkoutService.processCheckout({
        items,
        paymentMethod,
        amountPaid: paymentMethod === 'cash' ? Math.round(parseFloat(amountReceived) * 100) : 0,
        customerId: paymentMethod === 'utang' ? customerId : undefined,
        gcashReference: paymentMethod === 'gcash' ? referenceNumber : undefined,
        discount
      });
      
      showToast(`Sale of ₱${(total / 100).toFixed(2)} recorded!`, 'success');
      clearCart();
      setIsCheckoutModalOpen(false);
      setAmountReceived('');
      setReferenceNumber('');
      setCustomerId('');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error recording sale.', 'error');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:h-full">
      {/* Products Selection */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search products by name, SKU, or scan barcode..." 
              className="pl-9 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
          <Button variant="outline" size="icon" title="Scan Camera Barcode" onClick={() => setIsScannerOpen(true)}>
            <ScanLine className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 overflow-y-auto pb-4">
          {filteredProducts.map(product => {
            const stock = stockSummaries.get(product.id) || {
              productId: product.id,
              availableQuantity: 0,
              reservedQuantity: 0,
              sellableQuantity: 0,
              reorderLevel: product.reorderLevel || 0,
              status: 'out-of-stock' as const
            };
            const isOutOfStock = stock.status === 'out-of-stock' || stock.sellableQuantity <= 0;

            return (
              <div 
                key={product.id}
                onClick={() => !isOutOfStock && handleProductClick(product)}
                tabIndex={isOutOfStock ? -1 : 0}
                className={`bg-white border rounded-xl p-3 flex flex-col justify-between h-36 transition-all text-center ${
                  isOutOfStock 
                    ? 'opacity-60 border-destructive/30 cursor-not-allowed bg-muted/20' 
                    : 'border-border cursor-pointer hover:border-primary hover:shadow-sm'
                }`}
              >
                <div>
                  <div className="font-semibold text-sm line-clamp-2">{product.name}</div>
                  <div className="text-primary font-bold mt-1">₱{(product.sellingPrice / 100).toFixed(2)}</div>
                </div>

                <div className="mt-2 flex justify-center">
                  <StockIndicator
                    quantity={stock.sellableQuantity}
                    reorderLevel={stock.reorderLevel}
                    status={stock.status}
                    unit={product.unit}
                    compact
                  />
                </div>
              </div>
            );
          })}
          {filteredProducts.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No products found
            </div>
          )}
        </div>
      </div>

      {/* Cart Checkout */}
      <div className="w-full lg:w-96 bg-white border border-border rounded-xl flex flex-col shadow-sm mb-20 lg:mb-0 lg:h-auto">
        <div className="p-4 border-b border-border font-semibold flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          Current Sale
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Cart is empty
            </div>
          ) : (
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="flex justify-between items-center p-2 hover:bg-muted rounded-md group">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="text-sm font-medium truncate">{item.name}</div>
                    <div className="text-xs text-muted-foreground">₱{(item.price / 100).toFixed(2)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity - 1)} 
                      aria-label={`Decrease quantity of ${item.name}`}
                      className="w-6 h-6 flex items-center justify-center rounded-full bg-muted text-foreground hover:bg-border transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-medium w-4 text-center tabular-nums">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity + 1)} 
                      aria-label={`Increase quantity of ${item.name}`}
                      disabled={item.maxQuantity !== undefined && item.quantity >= item.maxQuantity}
                      className="w-6 h-6 flex items-center justify-center rounded-full bg-muted text-foreground hover:bg-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={() => removeItem(item.id)} 
                      aria-label={`Remove ${item.name} from cart`}
                      className="w-6 h-6 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border space-y-3 bg-muted/30">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">₱{(subtotal / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Discount</span>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">₱</span>
              <input 
                type="number" 
                aria-label="Discount amount in pesos"
                className="w-16 bg-transparent border-b border-border text-right focus:outline-none focus:border-primary tabular-nums"
                value={discount / 100 || ''}
                onChange={(e) => setDiscount(Math.round(parseFloat(e.target.value || '0') * 100))}
              />
            </div>
          </div>
          <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
            <span>Total</span>
            <span className="text-primary tabular-nums">₱{(total / 100).toFixed(2)}</span>
          </div>
          <Button 
            className="w-full h-12 text-lg mt-2" 
            disabled={items.length === 0}
            onClick={() => setIsCheckoutModalOpen(true)}
          >
            Charge ₱{(total / 100).toFixed(2)}
          </Button>
        </div>
      </div>

      <Modal isOpen={isCheckoutModalOpen} onClose={() => setIsCheckoutModalOpen(false)} title="Checkout">
        <form onSubmit={handleCheckout} className="space-y-6">
          <div className="flex flex-col gap-4 items-center mb-6">
            <div className="text-sm text-muted-foreground uppercase font-bold tracking-wider">Amount Due</div>
            <div className="text-4xl font-bold text-primary tabular-nums">₱{(total / 100).toFixed(2)}</div>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            {(['cash', 'gcash', 'utang'] as const).map(method => (
              <div 
                key={method}
                onClick={() => setPaymentMethod(method)}
                className={`p-3 text-center rounded-md cursor-pointer border-2 transition-all capitalize font-medium ${
                  paymentMethod === method 
                  ? 'border-primary bg-primary/10 text-primary' 
                  : 'border-border text-muted-foreground hover:border-muted-foreground'
                }`}
              >
                {method}
              </div>
            ))}
          </div>

          {paymentMethod === 'cash' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount Received (₱)</label>
                <Input 
                  type="number" 
                  step="0.01" 
                  required 
                  autoFocus
                  placeholder="0.00" 
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                />
              </div>
              <div className="flex justify-between items-center p-3 bg-muted rounded-md">
                <span className="font-medium text-muted-foreground">Change</span>
                <span className={`text-xl font-bold tabular-nums ${change < 0 ? 'text-destructive' : 'text-foreground'}`}>
                  ₱{(change / 100).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {paymentMethod === 'gcash' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <label className="text-sm font-medium">Reference Number (Optional)</label>
              <Input 
                placeholder="e.g. 10029384812" 
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
              />
            </div>
          )}

          {paymentMethod === 'utang' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <label className="text-sm font-medium">Select Customer</label>
              <select 
                aria-label="Select Customer"
                className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
              >
                <option value="" disabled>Choose a customer...</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>{customer.fullName}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsCheckoutModalOpen(false)}>Cancel</Button>
            <Button type="submit" size="lg" disabled={(paymentMethod === 'cash' && change < 0) || (paymentMethod === 'utang' && !customerId)}>Complete Sale</Button>
          </div>
        </form>
      </Modal>

      <BarcodeScannerModal 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
        onScan={handleScan} 
      />
    </div>
  );
}
