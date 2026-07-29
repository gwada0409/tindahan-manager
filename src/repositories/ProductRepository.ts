import { BaseRepository } from './BaseRepository';
import { Product } from '../types';
import { db } from '../db/database';

export class ProductRepository extends BaseRepository<Product> {
  constructor() {
    super(db.products);
  }

  async getLowStockProducts(): Promise<Product[]> {
    const products = await this.getAll();
    // Assuming simple inventory tracking where remaining stock is computed from batches
    // In a real scenario, this would be a more complex join.
    return products.filter(p => true); // Placeholder logic
  }
}

export const productRepo = new ProductRepository();
