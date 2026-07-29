import { create } from 'zustand';
import { Product, Service } from '@/types';

export interface CartItem {
  id: string; // product id or service id
  type: 'product' | 'service';
  name: string;
  price: number;
  quantity: number;
  maxQuantity?: number; // from inventory batch if product
}

interface CartStore {
  items: CartItem[];
  discount: number;
  addItem: (item: CartItem) => void;
  updateQuantity: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  setDiscount: (discount: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTotal: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  discount: 0,
  
  addItem: (item) => {
    set((state) => {
      const existing = state.items.find(i => i.id === item.id);
      if (existing) {
        const newQty = existing.quantity + item.quantity;
        if (existing.maxQuantity && newQty > existing.maxQuantity) {
          // Can't exceed stock
          return state;
        }
        return {
          items: state.items.map(i => 
            i.id === item.id ? { ...i, quantity: newQty } : i
          )
        };
      }
      return { items: [...state.items, item] };
    });
  },

  updateQuantity: (id, qty) => {
    set((state) => {
      if (qty <= 0) {
        return { items: state.items.filter(i => i.id !== id) };
      }
      return {
        items: state.items.map(i => {
          if (i.id === id) {
            if (i.maxQuantity && qty > i.maxQuantity) {
              return { ...i, quantity: i.maxQuantity };
            }
            return { ...i, quantity: qty };
          }
          return i;
        })
      };
    });
  },

  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter(i => i.id !== id)
    }));
  },

  setDiscount: (discount) => set({ discount }),

  clearCart: () => set({ items: [], discount: 0 }),

  getSubtotal: () => {
    const { items } = get();
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  },

  getTotal: () => {
    const { getSubtotal, discount } = get();
    const sub = getSubtotal();
    return Math.max(0, sub - discount);
  }
}));
